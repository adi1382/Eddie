// <eddie_source_header>
// This file is part of Eddie/AirVPN software.
// Copyright (C)2014-2026 AirVPN (support@airvpn.org) / https://airvpn.org
//
// Eddie is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Eddie is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Eddie. If not, see <http://www.gnu.org/licenses/>.
// </eddie_source_header>

use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, RecvTimeoutError, SyncSender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use serde_json::Value;

use crate::error::EngineError;
use crate::protocol;

struct Inner {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    pending: Mutex<HashMap<String, SyncSender<Value>>>,
    next_id: AtomicU64,
    closed: AtomicBool,
}

/// Bidirectional NDJSON client, independent from the transport.
///
/// The engine is normally a child process (see [`crate::EngineProcess`]), but
/// the client only needs a writer and a reader, which keeps it fully testable.
#[derive(Clone)]
pub struct EngineClient {
    inner: Arc<Inner>,
}

impl EngineClient {
    /// Creates a client writing requests to `writer`.
    pub fn new<W>(writer: W) -> Self
    where
        W: Write + Send + 'static,
    {
        EngineClient {
            inner: Arc::new(Inner {
                writer: Mutex::new(Some(Box::new(writer))),
                pending: Mutex::new(HashMap::new()),
                next_id: AtomicU64::new(1),
                closed: AtomicBool::new(false),
            }),
        }
    }

    /// Starts the thread reading the engine output.
    ///
    /// Replies are routed to the matching [`EngineClient::request`] caller,
    /// every other message is an unsolicited event and is passed to `on_event`.
    /// Lines that are not valid JSON objects are ignored: the engine shares its
    /// stdout with third party tools output.
    pub fn start_reader<R, F>(&self, reader: R, on_event: F) -> JoinHandle<()>
    where
        R: BufRead + Send + 'static,
        F: FnMut(Value) + Send + 'static,
    {
        self.start_reader_with_close(reader, on_event, || {})
    }

    /// Same as [`EngineClient::start_reader`], calling `on_close` once the
    /// engine output ends: the engine is gone and the client is unusable.
    pub fn start_reader_with_close<R, F, C>(
        &self,
        reader: R,
        mut on_event: F,
        on_close: C,
    ) -> JoinHandle<()>
    where
        R: BufRead + Send + 'static,
        F: FnMut(Value) + Send + 'static,
        C: FnOnce() + Send + 'static,
    {
        let inner = Arc::clone(&self.inner);

        std::thread::spawn(move || {
            for line in reader.lines() {
                let line = match line {
                    Ok(line) => line,
                    Err(_) => break,
                };

                let message = match protocol::parse_line(&line) {
                    Ok(message) => message,
                    Err(_) => continue,
                };

                match protocol::as_reply(&message) {
                    Some((id, body)) => {
                        let sender = inner.pending.lock().unwrap().remove(&id);
                        if let Some(sender) = sender {
                            let _ = sender.try_send(body);
                        } else {
                            // Late or unknown reply: surface it as an event
                            // instead of dropping it silently.
                            on_event(message);
                        }
                    }
                    None => on_event(message),
                }
            }

            Inner::close(&inner);
            on_close();
        })
    }

    /// Sends a message without waiting for a reply.
    pub fn send(&self, message: &Value) -> Result<(), EngineError> {
        if self.inner.closed.load(Ordering::SeqCst) {
            return Err(EngineError::NotRunning);
        }

        let line = protocol::encode_line(message)?;

        let mut guard = self.inner.writer.lock().unwrap();
        let writer = guard.as_mut().ok_or(EngineError::NotRunning)?;
        writer.write_all(line.as_bytes())?;
        writer.flush()?;

        Ok(())
    }

    /// Sends a request and waits for the matching reply.
    ///
    /// Returns the reply body, which may be `null` when the command has no
    /// result (the engine always answers a request carrying a `callback`).
    pub fn request(&self, message: &Value, timeout: Duration) -> Result<Value, EngineError> {
        let id = self
            .inner
            .next_id
            .fetch_add(1, Ordering::SeqCst)
            .to_string();

        let mut request = message.clone();
        protocol::set_callback(&mut request, &id)?;

        // Registered before sending, otherwise a fast reply could be dropped.
        let (sender, receiver) = sync_channel::<Value>(1);
        self.inner
            .pending
            .lock()
            .unwrap()
            .insert(id.clone(), sender);

        if let Err(err) = self.send(&request) {
            self.inner.pending.lock().unwrap().remove(&id);
            return Err(err);
        }

        match receiver.recv_timeout(timeout) {
            Ok(body) => Ok(body),
            Err(RecvTimeoutError::Timeout) => {
                self.inner.pending.lock().unwrap().remove(&id);
                Err(EngineError::Timeout)
            }
            Err(RecvTimeoutError::Disconnected) => {
                self.inner.pending.lock().unwrap().remove(&id);
                Err(EngineError::NotRunning)
            }
        }
    }

    /// Returns `false` once the engine stream is closed.
    pub fn is_running(&self) -> bool {
        !self.inner.closed.load(Ordering::SeqCst)
    }

    /// Closes the request stream and releases every pending request.
    pub fn close(&self) {
        Inner::close(&self.inner);
    }
}

impl Inner {
    fn close(inner: &Arc<Inner>) {
        inner.closed.store(true, Ordering::SeqCst);
        // Dropping the writer closes the engine stdin, dropping the senders
        // wakes up every pending request with a disconnection.
        let _ = inner.writer.lock().unwrap().take();
        inner.pending.lock().unwrap().clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::{BufReader, PipeWriter};

    /// Writer accumulating the lines sent to the engine.
    #[derive(Clone)]
    struct Sink(Arc<Mutex<Vec<u8>>>);

    impl Write for Sink {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    impl Sink {
        fn lines(&self) -> Vec<Value> {
            String::from_utf8(self.0.lock().unwrap().clone())
                .unwrap()
                .lines()
                .map(|line| serde_json::from_str(line).unwrap())
                .collect()
        }
    }

    fn write_line(writer: &mut PipeWriter, message: &Value) {
        writer
            .write_all(protocol::encode_line(message).unwrap().as_bytes())
            .unwrap();
        writer.flush().unwrap();
    }

    #[test]
    fn send_writes_one_line_per_message() {
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let client = EngineClient::new(sink.clone());

        client
            .send(&protocol::command("mainaction.connect"))
            .unwrap();
        client
            .send(&protocol::command("mainaction.disconnect"))
            .unwrap();

        assert_eq!(
            sink.lines(),
            vec![
                json!({ "command": "mainaction.connect" }),
                json!({ "command": "mainaction.disconnect" }),
            ]
        );
    }

    #[test]
    fn close_callback_runs_when_the_engine_output_ends() {
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let (reader, writer) = std::io::pipe().unwrap();
        let client = EngineClient::new(sink);
        let (sender, receiver) = std::sync::mpsc::channel();

        let handle = client.start_reader_with_close(
            BufReader::new(reader),
            |_| {},
            move || {
                let _ = sender.send(());
            },
        );

        // The engine exits: its stdout is closed.
        drop(writer);
        handle.join().unwrap();

        assert!(receiver.recv_timeout(Duration::from_secs(5)).is_ok());
        assert!(!client.is_running());
    }

    #[test]
    fn request_is_correlated_with_its_reply() {
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let (reader, mut writer) = std::io::pipe().unwrap();
        let client = EngineClient::new(sink.clone());
        client.start_reader(BufReader::new(reader), |_| {});

        // The fake engine answers as soon as the request is written.
        let sink_engine = sink.clone();
        std::thread::spawn(move || {
            let id = loop {
                if let Some(request) = sink_engine.lines().first().cloned() {
                    break request["callback"].as_str().unwrap().to_string();
                }
                std::thread::sleep(Duration::from_millis(5));
            };

            write_line(
                &mut writer,
                &json!({ "command": "reply", "id": id, "body": { "servers": [] } }),
            );

            // Keep the pipe open until the end of the test.
            std::thread::sleep(Duration::from_millis(200));
        });

        let body = client
            .request(
                &protocol::command("ui.servers.list"),
                Duration::from_secs(5),
            )
            .unwrap();

        assert_eq!(body, json!({ "servers": [] }));
    }

    #[test]
    fn events_and_invalid_lines_are_dispatched_correctly() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let (reader, mut writer) = std::io::pipe().unwrap();

        let client = EngineClient::new(sink);
        let collected = Arc::clone(&events);
        let handle = client.start_reader(BufReader::new(reader), move |message| {
            collected.lock().unwrap().push(message);
        });

        write_line(&mut writer, &json!({ "command": "engine.ready" }));
        writer.write_all(b"openvpn noise, not json\n").unwrap();
        write_line(
            &mut writer,
            &json!({ "command": "log", "message": "hello" }),
        );
        drop(writer);

        handle.join().unwrap();

        let events = events.lock().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["command"], json!("engine.ready"));
        assert_eq!(events[1]["message"], json!("hello"));
        assert!(!client.is_running());
    }

    #[test]
    fn request_times_out_without_reply() {
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let client = EngineClient::new(sink);

        let error = client
            .request(&protocol::command("man"), Duration::from_millis(50))
            .unwrap_err();

        assert!(matches!(error, EngineError::Timeout));
    }

    #[test]
    fn closed_client_refuses_to_send() {
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let client = EngineClient::new(sink);
        client.close();

        assert!(!client.is_running());
        assert!(matches!(
            client.send(&protocol::command("exit")).unwrap_err(),
            EngineError::NotRunning
        ));
    }
}
