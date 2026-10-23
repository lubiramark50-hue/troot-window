import unittest
from scripts.troot_dns_cutover import verify_operation, verify_zone, verify_record, HOST, OLD, NEW

class SafeDnsTests(unittest.TestCase):
    def test_confirmation(self):
        verify_operation("inspect", "")
        with self.assertRaises(ValueError): verify_operation("cutover", "")
        with self.assertRaises(ValueError): verify_operation("rollback", "SWITCH_TROOT_TO_CLOUDFLARE")
        verify_operation("cutover", "SWITCH_TROOT_TO_CLOUDFLARE")
        verify_operation("rollback", "RESTORE_TROOT_TO_NETLIFY")

    def test_zone_protection(self):
        zone = {"id": "abc", "name": "rentpay.site", "status": "active",
                "name_servers": ["curt.ns.cloudflare.com", "riya.ns.cloudflare.com"]}
        self.assertEqual(verify_zone(zone), "abc")
        with self.assertRaises(ValueError): verify_zone({**zone, "name": "other.site"})
        with self.assertRaises(ValueError): verify_zone({**zone, "name_servers": []})

    def test_record_protection(self):
        rec = {"id":"xyz", "name":HOST, "type":"CNAME", "content":OLD, "proxied":False}
        self.assertEqual(verify_record(rec), OLD)
        self.assertEqual(verify_record({**rec,"content":NEW}), NEW)
        for edit in ({"name":"mail.rentpay.site"}, {"type":"A"},
                     {"content":"unrecognized.site"}, {"proxied":True}, {"id":None}):
            with self.subTest(edit=edit), self.assertRaises(ValueError):
                verify_record({**rec,**edit})

if __name__ == "__main__":
    unittest.main()
