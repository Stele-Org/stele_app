"""Offline behavior checks with HTTPX MockTransport; no provider, credentials or real photo."""
from pathlib import Path
from io import BytesIO
import base64, hashlib, json, shutil, socket, tempfile, unittest
from unittest.mock import patch
import httpx
from PIL import Image

from stella_polza import (Catalog, PolzaClient, JobStatus, Disabled, SubmitUnknown,
                         SubmitRejected, StatusError, DownloadError, ValidationError)
import stella_polza.adapter as adapter

ROOT=Path(__file__).resolve().parents[1]
def png():
    data=BytesIO()
    Image.new("RGB",(32,32),(20,40,60)).save(data,format="PNG")
    return data.getvalue()
PNG=png()
PUBLIC_DNS=[(socket.AF_INET,socket.SOCK_STREAM,6,"",("93.184.216.34",443))]

class KitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=Catalog(ROOT)
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.folder=Path(self.tmp.name)
        self.photo=self.folder/"fixture.png";self.photo.write_bytes(PNG)
        self.prepared=self.catalog.prepare("01_BOEVIK","male",self.photo)
        self.calls=[];self.clients=[]
    def tearDown(self):
        for client in self.clients:client.close()
        self.tmp.cleanup()
    def client(self,handler,enabled=True,download_handler=None):
        def capture(request):
            self.calls.append(request)
            return handler(request)
        transport=httpx.MockTransport(capture)
        api=httpx.Client(transport=transport,follow_redirects=False,trust_env=False)
        download=httpx.Client(transport=httpx.MockTransport(download_handler or capture),headers={"Authorization":"should-not-leak"},trust_env=False)
        self.clients.extend([api,download])
        return PolzaClient("unit-test-not-a-real-key",enabled=enabled,http_client=api,download_client=download)
    def test_all20_variants_map_and_fit_prompt(self):
        self.assertEqual(len(self.catalog.genre_ids),10)
        for genre in self.catalog.genre_ids:
            for variant in ["male","female"]:
                prepared=self.catalog.prepare(genre,variant,self.photo)
                self.assertLessEqual(len(prepared.prompt),2996)
                self.assertTrue(prepared.cleanplate_path.is_file())
    def test_payload_photo_first_plate_second(self):
        payload=self.prepared.to_payload("package.item.attempt-1")
        self.assertEqual(payload["model"],"bytedance/seedream-5-lite")
        self.assertEqual(payload["input"]["quality"],"basic")
        self.assertEqual(base64.b64decode(payload["input"]["images"][0]["data"].split(",",1)[1]),PNG)
        self.assertEqual(hashlib.sha256(base64.b64decode(payload["input"]["images"][1]["data"].split(",",1)[1])).hexdigest(),self.prepared.cleanplate_sha256)
    def test_input_is_snapshot_after_source_changes(self):
        original=self.prepared.to_payload("x")
        self.photo.write_bytes(b"changed after admission")
        self.assertEqual(original,self.prepared.to_payload("x"))
    def test_prepared_repr_and_metadata_hide_photo(self):
        self.assertNotIn(str(self.photo),repr(self.prepared))
        self.assertNotIn("data:image",repr(self.prepared))
        self.assertNotIn("data:image",json.dumps(self.prepared.as_dict()))
    def test_bad_selection_and_correlation(self):
        for gender in ["guess",None]:
            with self.assertRaises(ValidationError):self.catalog.prepare("01_BOEVIK",gender,self.photo)
        with self.assertRaises(ValidationError):self.prepared.to_payload("bad\nmarker")
    def test_bad_photo_rejected(self):
        self.photo.write_text("<html>not an image</html>")
        with self.assertRaises(ValidationError):self.catalog.prepare("01_BOEVIK","male",self.photo)
    def test_pixel_cap_before_decode(self):
        with patch.object(adapter,"MAX_PIXELS",16):
            with self.assertRaises(ValidationError):self.catalog.prepare("01_BOEVIK","male",self.photo)
    def test_catalog_tamper_detected(self):
        root=self.folder/"catalog";(root/"assets/clean-plates").mkdir(parents=True);(root/"prompts").mkdir()
        shutil.copy2(ROOT/"prompts/recipes.json",root/"prompts/recipes.json")
        shutil.copy2(ROOT/"assets/manifest.json",root/"assets/manifest.json")
        manifest=json.loads((root/"assets/manifest.json").read_text())
        (root/"assets/clean-plates"/manifest["assets"][0]["output"]["file"]).write_bytes(PNG)
        with self.assertRaises(ValidationError):Catalog(root)
    def test_catalog_path_escape_rejected(self):
        root=self.folder/"catalog";(root/"assets").mkdir(parents=True);(root/"prompts").mkdir()
        shutil.copy2(ROOT/"prompts/recipes.json",root/"prompts/recipes.json")
        manifest=json.loads((ROOT/"assets/manifest.json").read_text());manifest["assets"][0]["output"]["file"]="../escape.png"
        (root/"assets/manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(ValidationError):Catalog(root)
    def test_disabled_never_sends(self):
        c=self.client(lambda r:httpx.Response(200,json={}),enabled=False)
        with self.assertRaises(Disabled):c.submit_once(self.prepared,"x")
        self.assertEqual(len(self.calls),0)
    def test_opaque_aig_id_and_single_submit(self):
        c=self.client(lambda r:httpx.Response(200,json={"id":"aig_case1","status":"pending"}))
        status=c.submit_once(self.prepared,"x")
        self.assertEqual(status.provider_id,"aig_case1")
        self.assertEqual(len(self.calls),1)
        self.assertEqual(self.calls[0].url.host,"polza.ai")
    def test_timeout_no_retry_and_no_sensitive_error(self):
        def fail(request):raise httpx.ReadTimeout("secret payload must not appear",request=request)
        c=self.client(fail)
        with self.assertRaises(SubmitUnknown) as caught:c.submit_once(self.prepared,"x")
        self.assertEqual(len(self.calls),1)
        self.assertNotIn("secret payload",str(caught.exception))
    def test_ambiguous_http_no_retry(self):
        for code in [302,429,500,503]:
            self.calls=[]
            c=self.client(lambda r,code=code:httpx.Response(code,headers={"Location":"https://other.invalid/"}))
            with self.assertRaises(SubmitUnknown):c.submit_once(self.prepared,"x")
            self.assertEqual(len(self.calls),1)
    def test_explicit_rejection(self):
        for code in [400,401,402,403,404,422]:
            c=self.client(lambda r,code=code:httpx.Response(code,json={"error":"private"}))
            with self.assertRaises(SubmitRejected) as caught:c.submit_once(self.prepared,"x")
            self.assertEqual(caught.exception.http_status,code)
    def test_invalid_ack_no_retry(self):
        c=self.client(lambda r:httpx.Response(200,content=b"not json"))
        with self.assertRaises(SubmitUnknown):c.submit_once(self.prepared,"x")
        self.assertEqual(len(self.calls),1)
    def test_partial_ack_retains_provider_id(self):
        c=self.client(lambda r:httpx.Response(200,json={"id":"aig_known","status":"new-unknown-status"}))
        with self.assertRaises(SubmitUnknown) as caught:c.submit_once(self.prepared,"x")
        self.assertEqual(caught.exception.provider_id,"aig_known")
    def test_get_status_never_posts_and_hides_url(self):
        c=self.client(lambda r:httpx.Response(200,json={"id":"job1","status":"completed","usage":{"cost_rub":"4"},"data":{"url":"https://cdn.example.org/result.png?private=token"}}),enabled=False)
        s=c.get_status("job1")
        self.assertEqual(str(s.cost_rub),"4")
        self.assertNotIn("private",repr(s));self.assertNotIn("private",json.dumps(s.as_dict()))
        self.assertEqual(self.calls[0].method,"GET")
    def test_failed_provider_code_without_raw_message(self):
        c=self.client(lambda r:httpx.Response(200,json={"id":"job1","status":"failed","error":{"code":"INPUT_INVALID","message":"photo/private/url"}}))
        s=c.get_status("job1")
        self.assertEqual(s.error_code,"INPUT_INVALID")
        self.assertNotIn("photo/private",json.dumps(s.as_dict()))
    def test_mismatched_status_id_rejected(self):
        c=self.client(lambda r:httpx.Response(200,json={"id":"someone-else","status":"completed"}))
        with self.assertRaises(StatusError):c.get_status("job1")
    def test_download_decode_atomic_and_no_auth(self):
        seen=[]
        def download(request):
            seen.append(request)
            return httpx.Response(200,content=PNG,headers={"Content-Type":"image/png"})
        c=self.client(lambda r:httpx.Response(200,json={}),download_handler=download)
        dest=self.folder/"result.png"
        with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS):
            result=c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/image.png"),dest)
        self.assertEqual(dest.read_bytes(),PNG)
        self.assertEqual((result.width,result.height),(32,32))
        self.assertNotIn("authorization",seen[0].headers)
        self.assertFalse(list(self.folder.glob(".polza-*")))
    def test_existing_result_not_overwritten(self):
        c=self.client(lambda r:httpx.Response(200,content=PNG))
        dest=self.folder/"result.png";dest.write_bytes(b"existing")
        with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS):
            with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/x"),dest)
        self.assertEqual(dest.read_bytes(),b"existing")
        self.assertEqual(len(self.calls),0)
    def test_cleanup_failure_does_not_revoke_saved_result(self):
        c=self.client(lambda r:httpx.Response(200,content=PNG))
        dest=self.folder/"result.png"
        with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS), patch.object(Path,"unlink",side_effect=PermissionError("temporary scanner lock")):
            result=c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/a"),dest)
        self.assertEqual(result.sha256,hashlib.sha256(PNG).hexdigest())
        self.assertEqual(dest.read_bytes(),PNG)
    def test_racing_output_not_overwritten(self):
        dest=self.folder/"result.png"
        def racing(request):
            dest.write_bytes(b"other-worker")
            return httpx.Response(200,content=PNG)
        c=self.client(lambda r:httpx.Response(200,json={}),download_handler=racing)
        with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS):
            with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/x"),dest)
        self.assertEqual(dest.read_bytes(),b"other-worker")
        self.assertFalse(list(self.folder.glob(".polza-*")))
    def test_private_and_unsafe_urls_rejected(self):
        c=self.client(lambda r:httpx.Response(200,content=PNG))
        urls=["http://cdn.example.org/a","https://127.0.0.1/a","https://169.254.169.254/a","https://user:password@cdn.example.org/a","https://cdn.example.org:8443/a"]
        for url in urls:
            with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url=url),self.folder/"result.png")
        with patch.object(adapter.socket,"getaddrinfo",return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,"",("10.0.0.1",443))]):
            with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/a"),self.folder/"result.png")
        self.assertEqual(len(self.calls),0)
    def test_invalid_download_and_size_limit(self):
        for body,headers in [(b"<html>bad</html>",{}),(PNG,{"Content-Length":str(26*1024*1024)})]:
            c=self.client(lambda r,body=body,headers=headers:httpx.Response(200,content=body,headers=headers))
            dest=self.folder/"result.png"
            with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS):
                with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/a"),dest)
            self.assertFalse(dest.exists())
    def test_no_redirect_to_storage(self):
        c=self.client(lambda r:httpx.Response(302,headers={"Location":"https://127.0.0.1/a"}))
        with patch.object(adapter.socket,"getaddrinfo",return_value=PUBLIC_DNS):
            with self.assertRaises(DownloadError):c.download_result(JobStatus("j","completed",_result_url="https://cdn.example.org/a"),self.folder/"result.png")
        self.assertEqual(len(self.calls),1)

if __name__=="__main__":unittest.main()

