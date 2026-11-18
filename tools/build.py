"""Build and lint the Android debug APK on Windows."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 14) or sys.platform != "win32":
        sys.exit("This build script requires Windows and Python 3.14 or later.")

    java_home = os.environ.get("JAVA_HOME")
    if not java_home or not all(
        (Path(java_home) / "bin" / f"{tool}.exe").is_file()
        for tool in ("java", "javac", "jlink")
    ):
        sys.exit("Set JAVA_HOME to a full JDK 17 or 21.")

    sdk_home = os.environ.get("ANDROID_HOME")
    if not sdk_home or not all(
        (Path(sdk_home) / file).is_file()
        for file in ("platforms/android-35/android.jar", "build-tools/34.0.0/aapt2.exe",
                     "platform-tools/adb.exe")
    ):
        sys.exit("Set ANDROID_HOME to the Android SDK with Platform 35, "
                 "Build-Tools 34.0.0 and Platform-Tools.")

    result = subprocess.run(
        ["cmd.exe", "/d", "/c", "gradlew.bat", "--no-daemon", "--max-workers=2",
         ":app:assembleDebug", ":app:lintDebug"],
        cwd=ROOT,
        check=False,
    )
    if result.returncode:
        sys.exit(result.returncode)
    apk = ROOT / "app/build/outputs/apk/debug/app-debug.apk"
    if not apk.is_file():
        sys.exit(f"Gradle completed but the debug APK is missing: {apk}")
    print(apk)


if __name__ == "__main__":
    main()
