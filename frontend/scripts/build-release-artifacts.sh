#!/usr/bin/env bash
set -euo pipefail

mode="${1:-both}"
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
signing_file="${SAFETY_SIGNING_PROPERTIES_FILE:-$HOME/.solo-youth-safety/signing/release-signing.properties}"
version="$(node -e "const fs=require('node:fs');const pkg=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));console.log(pkg.version);" "$project_dir/package.json")"
aab_source="$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
aab_target="$project_dir/android/app/build/outputs/bundle/release/solo-youth-safety-v${version}-release.aab"

if [[ ! -f "$signing_file" ]]; then
  echo "未找到 release 签名配置：$signing_file" >&2
  echo "请先运行：cd $project_dir && npm run android:release:setup-signing" >&2
  exit 1
fi

cd "$project_dir"
npm run build
npm run android:sync

case "$mode" in
  apk)
    (cd android && ./gradlew assembleRelease)
    ;;
  aab)
    (cd android && ./gradlew bundleRelease)
    ;;
  both)
    (cd android && ./gradlew assembleRelease bundleRelease)
    ;;
  *)
    echo "不支持的构建模式：$mode" >&2
    exit 1
    ;;
esac

if [[ "$mode" != "apk" && -f "$aab_source" ]]; then
  cp "$aab_source" "$aab_target"
fi

echo "Release 构建完成。"
[[ "$mode" != "aab" ]] && echo "APK：$project_dir/android/app/build/outputs/apk/release/solo-youth-safety-v${version}-release.apk"
[[ "$mode" != "apk" ]] && echo "AAB：$aab_target"
