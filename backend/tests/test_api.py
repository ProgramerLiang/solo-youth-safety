import importlib.util
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
MAIN_PATH = BACKEND_DIR / 'main.py'


def load_backend_module(db_path: Path):
    os.environ['SAFETY_DB_PATH'] = str(db_path)
    module_name = f'test_backend_main_{uuid4().hex}'
    spec = importlib.util.spec_from_file_location(module_name, MAIN_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def iso_utc(minutes_offset: int = 0) -> str:
    base_time = datetime(2026, 3, 24, 12, 0, tzinfo=timezone.utc)
    return (base_time + timedelta(minutes=minutes_offset)).isoformat()


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / 'safety-test.db'
        self.backend = load_backend_module(self.db_path)
        self.client = TestClient(self.backend.app)
        self.user_id = 'u_test'
        self.device_id = 'd_test'

    def tearDown(self):
        self.client.close()
        self.temp_dir.cleanup()
        os.environ.pop('SAFETY_DB_PATH', None)

    def save_config(self, **overrides):
        payload = {
            'userId': self.user_id,
            'callNumber': '',
            'smsNumber': '13800000000',
            'smsTemplate': self.backend.DEFAULT_TEMPLATE,
        }
        payload.update(overrides)
        return self.client.post('/api/v1/emergency/config', json=payload)

    def create_tracking_point(self, minutes_offset: int = 0):
        payload = {
            'userId': self.user_id,
            'deviceId': self.device_id,
            'points': [
                {
                    'lat': 31.23,
                    'lng': 121.47,
                    'accuracy': 12,
                    'speed': 0,
                    'heading': 0,
                    'timestamp': iso_utc(minutes_offset),
                }
            ],
        }
        return self.client.post('/api/v1/tracking/points', json=payload)

    def test_health_returns_ok(self):
        response = self.client.get('/api/v1/health')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def test_emergency_config_round_trip(self):
        response = self.save_config(smsTemplate='[SOS]{userId} {time}')
        config = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(config['userId'], self.user_id)
        self.assertIsNone(config['callNumber'])
        self.assertEqual(config['smsNumber'], '13800000000')

        fetched = self.client.get('/api/v1/emergency/config', params={'userId': self.user_id})
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()['smsTemplate'], '[SOS]{userId} {time}')

    def test_emergency_config_accepts_map_url_placeholder(self):
        response = self.save_config(smsTemplate='[SOS]{userId} {mapUrl}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['smsTemplate'], '[SOS]{userId} {mapUrl}')

    def test_emergency_config_blank_template_falls_back_to_default_template(self):
        response = self.save_config(smsTemplate='   ')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['smsTemplate'], self.backend.DEFAULT_TEMPLATE)
        self.assertIn('{mapUrl}', response.json()['smsTemplate'])

        fetched = self.client.get('/api/v1/emergency/config', params={'userId': self.user_id})
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()['smsTemplate'], self.backend.DEFAULT_TEMPLATE)
        self.assertIn('{mapUrl}', fetched.json()['smsTemplate'])

    def test_emergency_config_rejects_invalid_template(self):
        response = self.save_config(smsTemplate='[SOS]{foo}')

        self.assertEqual(response.status_code, 400)
        self.assertIn('不支持的占位符', response.json()['detail'])

    def test_build_map_url_generates_amap_marker_link(self):
        self.assertEqual(
            self.backend.build_map_url(31.23, 121.47),
            'https://uri.amap.com/marker?position=121.47,31.23',
        )

    def test_contacts_crud_round_trip(self):
        create_response = self.client.post(
            '/api/v1/contacts',
            json={
                'userId': self.user_id,
                'contact': {
                    'name': '妈妈',
                    'phone': '13800000000',
                },
            },
        )
        self.assertEqual(create_response.status_code, 200)
        self.assertEqual(create_response.json()['count'], 1)

        listed = self.client.get('/api/v1/contacts', params={'userId': self.user_id})
        contacts = listed.json()['contacts']
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(contacts), 1)
        contact_id = contacts[0]['id']

        update_response = self.client.put(
            f'/api/v1/contacts/{contact_id}',
            json={
                'userId': self.user_id,
                'contact': {
                    'name': '室友',
                    'phone': '13900000000',
                },
            },
        )
        self.assertEqual(update_response.status_code, 200)

        updated = self.client.get('/api/v1/contacts', params={'userId': self.user_id})
        self.assertEqual(updated.json()['contacts'][0]['name'], '室友')

        delete_response = self.client.delete(
            f'/api/v1/contacts/{contact_id}',
            params={'userId': self.user_id},
        )
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()['count'], 0)

    def test_tracking_timeline_round_trip_and_range_validation(self):
        create_response = self.create_tracking_point(minutes_offset=0)
        self.assertEqual(create_response.status_code, 200)

        timeline = self.client.get(
            '/api/v1/tracking/timeline',
            params={
                'userId': self.user_id,
                'from': iso_utc(-5),
                'to': iso_utc(5),
            },
        )
        self.assertEqual(timeline.status_code, 200)
        self.assertEqual(timeline.json()['count'], 1)

        invalid = self.client.get(
            '/api/v1/tracking/timeline',
            params={
                'userId': self.user_id,
                'from': iso_utc(5),
                'to': iso_utc(-5),
            },
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()['detail'], 'from must be earlier than to')

    def test_sos_event_persists_history_and_notifications(self):
        self.save_config(callNumber='110', smsNumber='13800000000')

        response = self.client.post(
            '/api/v1/sos/events',
            json={
                'userId': self.user_id,
                'deviceId': self.device_id,
                'location': {
                    'lat': 31.23,
                    'lng': 121.47,
                    'accuracy': 15,
                },
                'triggerType': 'manual',
                'timestamp': iso_utc(),
            },
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body['message'], 'sos received')
        self.assertEqual(len(body['notifications']), 2)
        self.assertEqual(body['notifications'][0]['channel'], 'call')
        self.assertEqual(body['notifications'][1]['channel'], 'sms')

        history = self.client.get('/api/v1/sos/events', params={'userId': self.user_id, 'limit': 20})
        history_body = history.json()
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history_body['count'], 1)
        self.assertEqual(history_body['items'][0]['id'], body['eventId'])
        self.assertEqual(len(history_body['items'][0]['notifications']), 2)

    def test_sos_sms_notification_detail_contains_map_url(self):
        self.save_config(smsTemplate='[SOS]{userId} {mapUrl}', smsNumber='13800000000')
        event = self.backend.SosEvent(
            userId=self.user_id,
            deviceId=self.device_id,
            location=self.backend.Location(lat=31.23, lng=121.47, accuracy=15),
            triggerType='manual',
            timestamp=datetime.fromisoformat(iso_utc()),
        )
        cfg = self.backend.EmergencyConfig(
            userId=self.user_id,
            callNumber=None,
            smsNumber='13800000000',
            smsTemplate='[SOS]{userId} {mapUrl}',
        )

        sms_content = self.backend.build_sms_content(event, cfg)
        self.assertEqual(
            sms_content,
            '[SOS]u_test https://uri.amap.com/marker?position=121.47,31.23',
        )

        response = self.client.post(
            '/api/v1/sos/events',
            json={
                'userId': self.user_id,
                'deviceId': self.device_id,
                'location': {
                    'lat': 31.23,
                    'lng': 121.47,
                    'accuracy': 15,
                },
                'triggerType': 'manual',
                'timestamp': iso_utc(),
            },
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertIn('https://uri.amap.com/marker?position=121.47,31.23', body['notifications'][1]['detail'])


if __name__ == '__main__':
    unittest.main()
