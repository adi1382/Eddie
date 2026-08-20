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

using System;
using System.Collections.Generic;
using System.Threading;

namespace Eddie.Core
{
	public class UiManager
	{
		private List<UiClient> Clients = new List<UiClient>();

		public class Command
		{
			public Json Request;
			public Json Response;
			public UiClient Sender;
			public AutoResetEvent Complete = new AutoResetEvent(false);
		}

		private List<Command> m_commands = new List<Command>();

		public static void Init()
		{

		}

		public UiClient GetContainerClient()
		{
			return Clients[0];
		}

		public void Add(UiClient client)
		{
			Clients.Add(client);
		}

		public void Broadcast(Json data)
		{
			foreach (UiClient client in Clients)
			{
				client.OnReceive(data);
			}
		}

		public void OnWork()
		{
			foreach (UiClient client in Clients)
			{
				client.OnWork();
			}
		}

		public Json SendCommand(Json request, UiClient sender)
		{
			Command c = new Command();
			c.Request = request;
			c.Sender = sender;
			lock (m_commands)
				m_commands.Add(c);
			c.Complete.WaitOne();
			return c.Response;
		}

		public void SendCommandDirect(Json request, UiClient sender)
		{
			Command c = new Command();
			c.Request = request;
			c.Sender = sender;
			lock (m_commands)
				m_commands.Add(c);
		}

		public Json ProcessCommand(Json data, UiClient sender)
		{
			Json apiResult = ApiManager.Process(data, sender);
			if (apiResult != null)
				return apiResult;

			string cmd = data["command"].Value as string;

			if (cmd == "exit")
			{
				Engine.Instance.ExitStart();
			}
			else if (cmd == "ui.boot.request")
			{
				Engine.Instance.UiBootRaise();
			}
			else if (cmd == "mainaction.connect")
			{
				Engine.Instance.Connect();
			}
			else if (cmd == "mainaction.disconnect")
			{
				Engine.Instance.Disconnect();
			}
			else if (cmd == "ui.servers.list")
			{
				return BuildServersList();
			}
			else if (cmd == "ui.areas.list")
			{
				return BuildAreasList();
			}
			else if (cmd == "servers.connect")
			{
				ConnectionInfo info = FindConnection(data["code"].ValueString);
				if ((info != null) && (info.CanConnect()))
				{
					Engine.Instance.NextServer = info;
					Engine.Instance.Connect();
				}
			}
			else if (cmd == "servers.userlist")
			{
				ConnectionInfo.UserListType listType = ConnectionInfo.UserListType.None;
				string listName = data["list"].ValueString;
				if (listName == "allowlist")
					listType = ConnectionInfo.UserListType.Allowlist;
				else if (listName == "denylist")
					listType = ConnectionInfo.UserListType.Denylist;

				foreach (string code in GetCodes(data))
				{
					ConnectionInfo info = FindConnection(code);
					if (info != null)
						info.UserList = listType;
				}

				Engine.Instance.UpdateSettings();
				Engine.Instance.OnRefreshUi();
			}
			else if (cmd == "areas.userlist")
			{
				AreaInfo.UserListType listType = AreaInfo.UserListType.None;
				string listName = data["list"].ValueString;
				if (listName == "allowlist")
					listType = AreaInfo.UserListType.Allowlist;
				else if (listName == "denylist")
					listType = AreaInfo.UserListType.Denylist;

				foreach (string code in GetCodes(data))
				{
					AreaInfo info = FindArea(code);
					if (info != null)
						info.UserList = listType;
				}

				Engine.Instance.UpdateSettings();
				Engine.Instance.OnRefreshUi();
			}
			else if (cmd == "servers.refresh")
			{
				Engine.Instance.RefreshProvidersInvalidateConnections();
			}
			else if (cmd == "session.login")
			{
				Engine.Instance.Login();
			}
			else if (cmd == "session.logout")
			{
				Engine.Instance.Logout();
			}
			else if (cmd == "system.report.start")
			{
				Report report = new Report();

				report.Start(sender);
			}
			else if (cmd == "tor.test")
			{
				Json result = new Json();
				result["result"].Value = TorControl.Test();
				return result;
			}
			else if (cmd == "tor.control")
			{
				string resultC = TorControl.SendCommand(data["command"].Value as string);
				foreach (string line in resultC.Split('\n'))
				{
					string l = line.Trim();
					if (l != "")
						Engine.Instance.Logs.Log(LogType.Verbose, l);
				}
			}
			else if (cmd == "options.set")
			{
				string name = data["name"].Value as string;

				if ((sender is WebserverClient) && (name != null) && (name.StartsWithInv("webui.")))
					return null; // WebServer clients cannot reconfigure the WebServer.

				Engine.Instance.ProfileOptions.Set(name, data["value"].Value);
			}
			else if (cmd == "webui.status")
			{
				Json result = new Json();
				result["enabled"].Value = Engine.Instance.ProfileOptions.GetBool("webui.enabled");
				result["port"].Value = Engine.Instance.ProfileOptions.GetInt("webui.port");
				result["running"].Value = (Engine.Instance.Webserver != null);
				result["url"].Value = (Engine.Instance.Webserver != null) ? (Engine.Instance.Webserver.ListenUrl + "/") : "";

				// The access key is a secret: expose it only to trusted (embedded) clients, never to the WebServer client.
				if ((sender is WebserverClient) == false)
					result["access_key"].Value = Engine.Instance.ProfileOptions.Get("webui.access_key");

				return result;
			}
			else if (cmd == "webui.regenerate_key")
			{
				if (sender is WebserverClient)
					return null; // Only trusted clients may rotate the key.

				// Rotating the key changes the HMAC key used to sign session cookies,
				// which invalidates every previously issued session token.
				Engine.Instance.ProfileOptions.Set("webui.access_key", RandomGenerator.GetHash());
				Engine.Instance.SaveSettings();

				Json result = new Json();
				result["access_key"].Value = Engine.Instance.ProfileOptions.Get("webui.access_key");
				return result;
			}
			else if (cmd == "ui.stats.pathprofile")
			{
				Platform.Instance.OpenDirectoryInFileManager(Engine.Instance.Stats.Get("PathProfile").Value);
			}
			else if (cmd == "ui.stats.pathdata")
			{
				Platform.Instance.OpenDirectoryInFileManager(Engine.Instance.Stats.Get("PathData").Value);
			}
			else if (cmd == "ui.stats.pathapp")
			{
				Platform.Instance.OpenDirectoryInFileManager(Engine.Instance.Stats.Get("PathApp").Value);
			}
			else if (cmd == "man")
			{
				string format = "text";
				if (data.HasKey("format"))
					format = data["format"].Value as string;
				Json result = new Json();
				result["layout"].Value = "text";
				result["title"].Value = "MAN";
				result["body"].Value = Engine.Instance.ProfileOptions.GetMan(format);
				return result;
			}
			else if (cmd == "tor.guard")
			{
				Engine.Instance.Logs.LogVerbose("Tor Guard IPs:" + TorControl.GetGuardIps(true).ToString());
			}
			else if (cmd == "tor.NEWNYM")
			{
				TorControl.SendNEWNYM();
			}
			else if (cmd == "ip.exit")
			{
				Engine.Instance.Logs.LogVerbose(Engine.Instance.DiscoverExit().ToString());
			}
			else if (cmd == "directory.open")
			{
				Platform.Instance.OpenFolder(data["path"].ValueString);
			}
			else if (cmd == "url.open")
			{
				Platform.Instance.OpenUrl(data["uri"].ValueString);
			}
			else if (cmd == "test.query")
			{
				Json result = new Json();
				result["result"].Value = cmd;
				result["ts"].Value = DateTime.Now.ToString();
				return result;
			}
			else if (cmd == "test.logs")
			{
				//Engine.Instance.Logs.Log(LogType.InfoImportant, "Test log\nInfo");
				//Engine.Instance.Logs.Log(LogType.InfoImportant, "Test log\nInfo Important");
				Engine.Instance.Logs.Log(LogType.Warning, "Test log\nWarning\n" + DateTime.Now.ToString());
				//Engine.Instance.Logs.Log(LogType.Error, "Test log\nError");
				//Engine.Instance.Logs.Log(LogType.Fatal, "Test log\nFatal");
			}

			return null;
		}

		// Servers and areas, for detached UI clients (jsoninout / webserver).
		// In-process UI (Forms/Cocoa) read the same data directly from the Engine.

		private static List<string> GetCodes(Json data)
		{
			List<string> codes = new List<string>();

			if (data.HasKey("codes"))
			{
				Json jCodes = data["codes"].Value as Json;
				if ((jCodes != null) && (jCodes.IsArray()))
				{
					foreach (object item in jCodes.GetArray())
						if (item != null)
							codes.Add(item.ToString());
				}
			}

			if (data.HasKey("code"))
				codes.Add(data["code"].ValueString);

			return codes;
		}

		private static ConnectionInfo FindConnection(string code)
		{
			lock (Engine.Instance.Connections)
			{
				if (Engine.Instance.Connections.ContainsKey(code))
					return Engine.Instance.Connections[code];
			}
			return null;
		}

		private static AreaInfo FindArea(string code)
		{
			lock (Engine.Instance.Areas)
			{
				if (Engine.Instance.Areas.ContainsKey(code))
					return Engine.Instance.Areas[code];
			}
			return null;
		}

		private static string UserListToString(ConnectionInfo.UserListType type)
		{
			if (type == ConnectionInfo.UserListType.Allowlist)
				return "allowlist";
			else if (type == ConnectionInfo.UserListType.Denylist)
				return "denylist";
			else
				return "none";
		}

		private static string UserListToString(AreaInfo.UserListType type)
		{
			if (type == AreaInfo.UserListType.Allowlist)
				return "allowlist";
			else if (type == AreaInfo.UserListType.Denylist)
				return "denylist";
			else
				return "none";
		}

		private static Json BuildServersList()
		{
			Json result = new Json();
			Json jServers = new Json();
			jServers.InitAsArray();

			lock (Engine.Instance.Connections)
			{
				foreach (ConnectionInfo info in Engine.Instance.Connections.Values)
				{
					Json jServer = new Json();
					jServer["code"].Value = info.Code;
					jServer["name"].Value = info.DisplayName;
					jServer["name_list"].Value = info.GetNameForList();
					jServer["provider"].Value = info.ProviderName;
					jServer["country_code"].Value = info.CountryCode;
					jServer["country_name"].Value = CountriesManager.GetNameFromCode(info.CountryCode);
					jServer["location"].Value = info.Location;
					jServer["latitude"].Value = info.Latitude;
					jServer["longitude"].Value = info.Longitude;
					jServer["ping"].Value = info.Ping;
					jServer["load"].Value = info.GetLoadForList();
					jServer["load_perc"].Value = info.GetLoadPercForList();
					jServer["load_color"].Value = info.GetLoadColorForList();
					jServer["users"].Value = info.Users;
					jServer["score"].Value = info.Score();
					jServer["user_list"].Value = UserListToString(info.UserList);
					jServer["can_connect"].Value = info.CanConnect();
					jServer["warning"].Value = info.HasWarnings();
					jServer["error"].Value = info.HasWarningsErrors();
					jServers.Append(jServer);
				}
			}

			result["servers"].Value = jServers;
			return result;
		}

		private static Json BuildAreasList()
		{
			Json result = new Json();
			Json jAreas = new Json();
			jAreas.InitAsArray();

			lock (Engine.Instance.Areas)
			{
				foreach (AreaInfo info in Engine.Instance.Areas.Values)
				{
					Json jArea = new Json();
					jArea["code"].Value = info.Code;
					jArea["name"].Value = info.GetNameForList();
					jArea["servers"].Value = info.Servers;
					jArea["users"].Value = info.Users;
					jArea["load"].Value = info.GetLoadForList();
					jArea["load_perc"].Value = info.GetLoadPercForList();
					jArea["load_color"].Value = info.GetLoadColorForList();
					jArea["user_list"].Value = UserListToString(info.UserList);
					jAreas.Append(jArea);
				}
			}

			result["areas"].Value = jAreas;
			return result;
		}

		public void ProcessOnMainThread()		{
			lock (m_commands)
			{
				Command c = null;
				if (m_commands.Count > 0)
				{
					c = m_commands[0];
					m_commands.RemoveAt(0);

					c.Response = ProcessCommand(c.Request, c.Sender);
					c.Complete.Set();

					if ((c.Sender != null) && (c.Request.HasKey("callback")))
					{
						Json jReply = new Json();
						jReply["command"].Value = "reply";
						jReply["id"].Value = c.Request["callback"].ValueString;
						jReply["body"].Value = c.Response;
						c.Sender.OnReceive(jReply);
					}
				}
			}
		}

		// Helper
		public void Broadcast(string command)
		{
			Json j = new Json();
			j["command"].Value = command;
			Broadcast(j);
		}

		public void Broadcast(string command, string key1, string val1)
		{
			Json j = new Json();
			j["command"].Value = command;
			j[key1].Value = val1;
			Broadcast(j);
		}
	}
}
