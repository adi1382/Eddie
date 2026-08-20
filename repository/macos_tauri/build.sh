#!/bin/bash

# Build the Eddie UI (Tauri edition) .app bundle for macOS, arm64 or x64.
#
# Unlike the legacy Mono/Xamarin UI, this line cross-compiles: an arm64 build
# can be produced from an Intel Mac and vice versa, because both the .NET
# engine (dotnet publish --runtime) and the Rust UI (cargo --target) support it.

set -euo pipefail

SCRIPTDIR="$(cd "$(dirname "$0")" && pwd -P)"

# Check args

ARCH="${1-arm64}"

if [ "${ARCH}" != "arm64" ] && [ "${ARCH}" != "x64" ]; then
    echo "First arg must be Arch: arm64, x64"
    exit 1
fi

if [ "${ARCH}" = "arm64" ]; then
    RID="osx-arm64"
    RUSTTARGET="aarch64-apple-darwin"
else
    RID="osx-x64"
    RUSTTARGET="x86_64-apple-darwin"
fi

CONFIG=Release
VERSION=$("${SCRIPTDIR}/../macos_common/get-version.sh")
SOURCEDIR="${SCRIPTDIR}/../../src"
UIDIR="${SOURCEDIR}/App.UI.Tauri"

TARGETDIR="/tmp/eddie_deploy/eddie-ui-tauri_${VERSION}_macos_${ARCH}"
APPDIR="${TARGETDIR}/Eddie.app"
BINDIR="${APPDIR}/Contents/MacOS"
RESDIR="${APPDIR}/Contents/Resources"
FINALPATH="/tmp/eddie_deploy/eddie-ui-tauri_${VERSION}_macos_${ARCH}.zip"
DEPLOYPATH="${SCRIPTDIR}/../files/eddie-ui-tauri_${VERSION}_macos_${ARCH}.zip"

# Check env

if [ "$(uname -s)" != "Darwin" ]; then
    echo "Error: this script builds a macOS bundle and must run on macOS." >&2
    exit 1
fi

if ! [ -x "$(command -v dotnet)" ]; then
    echo 'Error: dotnet is not installed.' >&2
    exit 1
fi

if ! [ -x "$(command -v cargo)" ]; then
    echo 'Error: cargo is not installed. Install Rust: https://rustup.rs' >&2
    exit 1
fi

if ! cargo tauri --version >/dev/null 2>&1; then
    echo 'Error: cargo-tauri is not installed. Run: cargo install tauri-cli --version "^2"' >&2
    exit 1
fi

if [ -x "$(command -v rustup)" ]; then
    rustup target add "${RUSTTARGET}"
fi

mkdir -p "${SCRIPTDIR}/../files"

if test -f "${DEPLOYPATH}"; then
    echo "Already builded: ${DEPLOYPATH}"
    exit 0
fi

# Note: ensure deploy files signature before compiling Elevated, otherwise the
# sha256 of openvpn/wg compiled in Elevated will not match. Same as build_all_macos.sh.
"${SCRIPTDIR}/../macos_common/presign.sh"

rm -rf "${TARGETDIR}"
mkdir -p "${TARGETDIR}"

# Build the engine (CLI)

echo "Step: Build engine (${RID})"

cd "${SOURCEDIR}/App.CLI.MacOS/"
dotnet publish App.CLI.MacOS.net10.csproj --configuration ${CONFIG} --runtime ${RID} --self-contained true
PUBLISHDIR="${SOURCEDIR}/App.CLI.MacOS/bin/${CONFIG}/net10.0/${RID}"

# Build the UI (Tauri)

echo "Step: Build UI (${RUSTTARGET})"

cd "${UIDIR}"
cargo tauri build --target "${RUSTTARGET}" --bundles app

BUNDLEAPP="${UIDIR}/target/${RUSTTARGET}/release/bundle/macos/Eddie.app"
if [ ! -d "${BUNDLEAPP}" ]; then
    echo "Error: bundle not found in ${BUNDLEAPP}" >&2
    exit 1
fi

cp -R "${BUNDLEAPP}" "${APPDIR}"
mkdir -p "${RESDIR}"

# Layout: the engine, its native library, the elevated helpers and the VPN
# tools live next to the UI executable in Contents/MacOS, exactly like the
# legacy bundle, so the engine finds its tools with the same relative paths.

echo "Step: Engine files"

cp "${PUBLISHDIR}/publish/Eddie-CLI" "${BINDIR}"
cp "${PUBLISHDIR}/eddie-cli-elevated" "${BINDIR}"
cp "${PUBLISHDIR}/eddie-cli-elevated-service" "${BINDIR}"
cp "${PUBLISHDIR}/libLib.Platform.MacOS.Native.dylib" "${BINDIR}"

echo "Step: Resources"

cp "${SCRIPTDIR}/../../deploy/macos_${ARCH}"/* "${BINDIR}"
cp -R "${SCRIPTDIR}/../../resources"/* "${RESDIR}"
# The Web UI is not part of this line: the Tauri window is the UI.
rm -rf "${RESDIR}/webui"

# Cleanup

echo "Step: Cleanup"
rm -f "${BINDIR}/"*.profile
rm -f "${BINDIR}/"*.pdb
rm -f "${BINDIR}/"*.config
rm -f "${BINDIR}/Recovery.xml"

# Owner and Permissions

echo "Step: Owner and Permissions"

chmod -R 755 "${BINDIR}"
find "${BINDIR}" -type f -exec chmod 644 {} +
chmod 755 "${BINDIR}/Eddie"
chmod 755 "${BINDIR}/Eddie-CLI"
chmod 755 "${BINDIR}/eddie-cli-elevated"
chmod 755 "${BINDIR}/eddie-cli-elevated-service"
chmod 755 "${BINDIR}/openvpn"
chmod 755 "${BINDIR}/hummingbird"
chmod 755 "${BINDIR}/stunnel"
chmod 755 "${BINDIR}/wireguard-go"
chmod 755 "${BINDIR}/wg"

# Signing
# Remember: never sign openvpn/wg again here, changing it invalidate the hash already compiled in Elevated.

VARHARDENING="yes"

echo "Step: Signing"

"${SCRIPTDIR}/../macos_common/sign.sh" "${BINDIR}/eddie-cli-elevated" no $VARHARDENING
"${SCRIPTDIR}/../macos_common/sign.sh" "${BINDIR}/eddie-cli-elevated-service" no $VARHARDENING
"${SCRIPTDIR}/../macos_common/sign.sh" "${BINDIR}/libLib.Platform.MacOS.Native.dylib" no $VARHARDENING
"${SCRIPTDIR}/../macos_common/sign.sh" "${BINDIR}/Eddie-CLI" no $VARHARDENING
"${SCRIPTDIR}/../macos_common/sign.sh" "${BINDIR}/Eddie" yes $VARHARDENING
"${SCRIPTDIR}/../macos_common/sign.sh" "${APPDIR}" yes $VARHARDENING

# Build archive

echo "Step: Build archive"
touch "${APPDIR}"
cd "${TARGETDIR}"
rm -f "${FINALPATH}"
zip -r "${FINALPATH}" "Eddie.app"

# Staff Deploy
if test -n "${EDDIESIGNINGDIR:-}"; then
    "${SCRIPTDIR}/../macos_common/sign.sh" "${FINALPATH}" yes $VARHARDENING

    if [ ${VARHARDENING} = "yes" ]; then
        "${SCRIPTDIR}/../macos_common/notarize.sh" "${FINALPATH}"
    fi

    "${SCRIPTDIR}/../macos_common/deploy.sh" "${FINALPATH}" "internal"

    "${SCRIPTDIR}/../macos_common/sign-openpgp.sh" "${FINALPATH}"
    test -f "${FINALPATH}.asc" && "${SCRIPTDIR}/../macos_common/deploy.sh" "${FINALPATH}.asc" "internal"
fi

# End

mv "${FINALPATH}" "${DEPLOYPATH}"
test -f "${FINALPATH}.asc" && mv "${FINALPATH}.asc" "${DEPLOYPATH}.asc"

echo "Step: Final cleanup"
rm -rf "${TARGETDIR}"

echo "Done: ${DEPLOYPATH}"
