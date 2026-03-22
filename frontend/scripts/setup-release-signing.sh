#!/usr/bin/env bash
set -euo pipefail

signing_dir="${SAFETY_SIGNING_DIR:-$HOME/.solo-youth-safety/signing}"
backup_dir="${SAFETY_SIGNING_BACKUP_DIR:-$HOME/Desktop/solo-youth-safety-signing-backup}"
store_file="$signing_dir/solo-youth-safety-release.jks"
properties_file="$signing_dir/release-signing.properties"
backup_store_file="$backup_dir/solo-youth-safety-release.jks"
backup_properties_file="$backup_dir/release-signing.properties"
alias_name="solo-youth-safety-release"

mkdir -p "$signing_dir" "$backup_dir"
chmod 700 "$signing_dir" "$backup_dir"

if [[ -f "$store_file" && ! -f "$properties_file" ]] || [[ ! -f "$store_file" && -f "$properties_file" ]]; then
  echo "检测到签名文件不完整，请先手动检查：$signing_dir" >&2
  exit 1
fi

if [[ ! -f "$store_file" ]]; then
  store_password="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
  key_password="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"

  keytool -genkeypair -v \
    -keystore "$store_file" \
    -storetype JKS \
    -storepass "$store_password" \
    -keypass "$key_password" \
    -alias "$alias_name" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 3650 \
    -dname "CN=Solo Youth Safety, OU=Android Release, O=Solo Youth Safety, L=Shanghai, ST=Shanghai, C=CN"

  cat > "$properties_file" <<EOF
storeFile=$store_file
storePassword=$store_password
keyAlias=$alias_name
keyPassword=$key_password
EOF
fi

cp "$store_file" "$backup_store_file"
cp "$properties_file" "$backup_properties_file"
sha256sum "$store_file" "$properties_file" > "$backup_dir/SHA256SUMS.txt"
chmod 600 "$store_file" "$properties_file" "$backup_store_file" "$backup_properties_file" "$backup_dir/SHA256SUMS.txt"

cat > "$backup_dir/README.txt" <<EOF
Solo Youth Safety Android release signing backup

主签名目录：$signing_dir
主属性文件：$properties_file
主 keystore：$store_file

当前备份目录：$backup_dir
请继续额外复制到离线介质或密码管理器，不要提交到 Git 仓库。
EOF
chmod 600 "$backup_dir/README.txt"

echo "签名资产已就绪。"
echo "主目录：$signing_dir"
echo "备份目录：$backup_dir"
