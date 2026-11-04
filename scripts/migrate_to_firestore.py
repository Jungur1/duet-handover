# -*- coding: utf-8 -*-
"""
[Duet 제18대 학생회 인수인계 포털]
로컬 백업 데이터 -> Cloud Firestore 일괄 마이그레이션 스크립트 (Python 버전)

사용 방법:
  1. (최초 1회) pip install firebase-admin
  2. Firebase 콘솔에서 다운로드한 서비스 계정 JSON 파일을 루트에 두고 'serviceAccountKey.json'으로 이름 변경
     (또는 .env 파일에 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 설정)
  3. python scripts/migrate_to_firestore.py
"""

import os
import sys
import json
import time

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("\n[안내] firebase-admin 패키지가 필요합니다.")
    print("터미널에서 아래 명령어를 실행해 주세요:")
    print("    pip install firebase-admin\n")
    sys.exit(1)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.join(ROOT_DIR, "backup_local")

def load_credentials():
    # 1. serviceAccountKey.json 파일 우선 탐색
    for candidate in ["serviceAccountKey.json", "firebase-adminsdk.json"]:
        path = os.path.join(ROOT_DIR, candidate)
        if os.path.exists(path):
            print(f"🔑 서비스 계정 키 파일 감지: {candidate}")
            return credentials.Certificate(path)

    # 2. .env 파일 탐색
    env_path = os.path.join(ROOT_DIR, ".env")
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    v = v.strip().strip('"').strip("'")
                    env_vars[k.strip()] = v

    proj_id = env_vars.get("FIREBASE_PROJECT_ID") or os.environ.get("FIREBASE_PROJECT_ID")
    client_email = env_vars.get("FIREBASE_CLIENT_EMAIL") or os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = env_vars.get("FIREBASE_PRIVATE_KEY") or os.environ.get("FIREBASE_PRIVATE_KEY")

    if proj_id and client_email and private_key and "your-firebase" not in proj_id:
        print("🔑 .env 환경변수로부터 서비스 계정 인증 정보를 불러왔습니다.")
        cert_dict = {
            "project_id": proj_id,
            "client_email": client_email,
            "private_key": private_key.replace("\\n", "\n")
        }
        return credentials.Certificate(cert_dict)

    print("\n❌ Firebase 인증 정보를 찾을 수 없습니다!")
    print("다음 중 한 가지 방법을 진행해 주세요:")
    print("  방법 A. Firebase 콘솔에서 다운로드한 비공개 키 JSON 파일을")
    print("          프로젝트 루트 폴더에 'serviceAccountKey.json' 이름으로 저장 (.gitignore 처리됨)")
    print("  방법 B. .env 파일에 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 입력\n")
    sys.exit(1)

def load_data():
    data_json = os.path.join(BACKUP_DIR, "data.json")
    sections_json = os.path.join(BACKUP_DIR, "sections_data.json")

    if not os.path.exists(data_json) or not os.path.exists(sections_json):
        print("❌ backup_local 폴더의 data.json 또는 sections_data.json을 찾을 수 없습니다.")
        sys.exit(1)

    with open(data_json, "r", encoding="utf-8") as f:
        default_data = json.load(f)

    with open(sections_json, "r", encoding="utf-8") as f:
        sections_data = json.load(f)

    return default_data, sections_data

def main():
    cred = load_credentials()
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    default_data, sections_data = load_data()
    now_ms = int(time.time() * 1000)

    # 1. portal_data/meta & custom_edits
    print("⏳ 1/4: portal_data 컬렉션 업로드 중...")
    db.collection("portal_data").document("meta").set({
        "meta": default_data.get("meta", {}),
        "monthlyReports": default_data.get("monthlyReports", []),
        "updatedAt": now_ms
    })

    if "customEdits" in default_data and default_data["customEdits"]:
        custom_edits = dict(default_data["customEdits"])
        custom_edits["updatedAt"] = now_ms
        db.collection("portal_data").document("custom_edits").set(custom_edits)

    # 2. drive_links/{linkId}
    print("⏳ 2/4: drive_links 컬렉션 업로드 중...")
    drive_links = default_data.get("driveLinks", [])
    for idx, dl in enumerate(drive_links):
        doc_id = dl.get("id") or f"link_{idx}"
        data = dict(dl)
        data["order"] = idx
        if "roles" not in data or not data["roles"]:
            if data.get("category") == "executive":
                data["roles"] = ["duet_pres", "next_pres"]
            else:
                data["roles"] = ["duet_pres", "duet_head", "next_pres", "next_head"]
        db.collection("drive_links").document(doc_id).set(data)

    # 3. sections/{tabId}
    print("⏳ 3/4: sections 컬렉션 업로드 중...")
    for tab_id, content in sections_data.items():
        db.collection("sections").document(tab_id).set({
            "tabId": tab_id,
            "content": content,
            "updatedAt": now_ms
        })

    # 4. calendar_events/{eventId} (배치 처리)
    events = default_data.get("calendarEvents", [])
    print(f"⏳ 4/4: calendar_events 컬렉션 ({len(events)}건) 업로드 중...")
    chunk_size = 400
    for i in range(0, len(events), chunk_size):
        chunk = events[i:i + chunk_size]
        batch = db.batch()
        for ev in chunk:
            doc_id = str(ev.get("id"))
            ref = db.collection("calendar_events").document(doc_id)
            batch.set(ref, ev)
        batch.commit()

    print("\n✅ [성공] Cloud Firestore 데이터 마이그레이션이 100% 완료되었습니다!")

if __name__ == "__main__":
    main()
