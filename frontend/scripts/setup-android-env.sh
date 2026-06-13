#!/usr/bin/env bash
set -euo pipefail

# 安装 JDK 17 + Android SDK 命令行工具
# 用法：sudo bash setup-android-env.sh

echo "=== 安装 OpenJDK 17 ==="
apt-get update -qq
apt-get install -y -qq openjdk-17-jdk wget unzip

JAVA_HOME=$(update-alternatives --list java | head -1 | sed 's|/bin/java$||')
echo "JAVA_HOME=$JAVA_HOME"

echo "=== 安装 Android SDK 命令行工具 ==="
SDK_ROOT="/opt/android-sdk"
mkdir -p "$SDK_ROOT"

CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
CMDLINE_TOOLS_ZIP="/tmp/cmdline-tools.zip"

if [ ! -f "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  wget -q "$CMDLINE_TOOLS_URL" -O "$CMDLINE_TOOLS_ZIP"
  unzip -q "$CMDLINE_TOOLS_ZIP" -d "$SDK_ROOT"
  mkdir -p "$SDK_ROOT/cmdline-tools/latest"
  mv "$SDK_ROOT/cmdline-tools/bin" "$SDK_ROOT/cmdline-tools/latest/"
  mv "$SDK_ROOT/cmdline-tools/lib" "$SDK_ROOT/cmdline-tools/latest/"
  rm -f "$CMDLINE_TOOLS_ZIP"
fi

export JAVA_HOME
export ANDROID_HOME="$SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "=== 接受 Android  licenses ==="
yes | sdkmanager --licenses > /dev/null 2>&1 || true

echo "=== 安装 Android SDK build-tools 34 + platform 34 ==="
sdkmanager "build-tools;34.0.0" "platforms;android-34" > /dev/null 2>&1

echo "=== 写入 /etc/profile.d/android-env.sh ==="
cat > /etc/profile.d/android-env.sh << 'EOF'
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
EOF
chmod 644 /etc/profile.d/android-env.sh

echo ""
echo "=== 安装完成 ==="
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$SDK_ROOT"
echo ""
echo "请执行以下命令加载环境变量："
echo "  source /etc/profile.d/android-env.sh"
echo ""
echo "然后在 frontend/ 目录下执行："
echo "  npm run build && npm run android:sync && npm run android:apk"