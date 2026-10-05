"""Offline inspection only. Paid calls are available solely through the explicit library API."""
from pathlib import Path
import argparse, hashlib, json, sys

ROOT = Path(__file__).resolve().parent

def verify():
    from PIL import Image
    manifest = json.loads((ROOT/"assets/manifest.json").read_text(encoding="utf-8"))
    recipes = json.loads((ROOT/"prompts/recipes.json").read_text(encoding="utf-8"))
    assert len(manifest["assets"]) == 20 and len(recipes["recipes"]) == 10
    seen = set()
    for row in manifest["assets"]:
        path = ROOT/"assets/clean-plates"/row["output"]["file"]
        if path.resolve().parent != (ROOT/"assets/clean-plates").resolve():
            raise ValueError("Asset path leaves catalog")
        assert path.name not in seen; seen.add(path.name)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row["output"]["sha256"], path.name
        with Image.open(path) as image:
            image.load()
            assert list(image.size) == [row["output"]["width"],row["output"]["height"]]
    lengths=[]
    for recipe in recipes["recipes"]:
        for variant in ["male","female"]:
            assert recipe["png"][variant] in seen
            prompt="\n\n".join([recipes["prefix"],recipe["common"],recipe[variant]])
            assert len(prompt)<=2996
            lengths.append(len(prompt))
    assert len(list((ROOT/"assets/clean-plates").glob("*.png")))==20
    evidence=json.loads((ROOT/"evidence/accepted-result.json").read_text(encoding="utf-8"))
    assert hashlib.sha256((ROOT/"evidence"/evidence["output"]).read_bytes()).hexdigest()==evidence["output_sha256"]
    assert hashlib.sha256((ROOT/"evidence/accepted-prompt.txt").read_bytes()).hexdigest()==evidence["prompt_sha256"]
    release=ROOT/"KIT_MANIFEST.json"
    if release.exists():
        package=json.loads(release.read_text(encoding="utf-8"))
        for row in package["files"]:
            p=(ROOT/row["path"]).resolve()
            if ROOT not in p.parents: raise ValueError("Manifest path leaves kit")
            assert hashlib.sha256(p.read_bytes()).hexdigest()==row["sha256"],row["path"]
    return {"status":"pass","assets":20,"recipes":10,"variants":20,"promptCharacters":[min(lengths),max(lengths)],"networkRequests":0}

def main():
    parser=argparse.ArgumentParser(description="Offline VK poster kit inspector. Does not call AI.")
    sub=parser.add_subparsers(dest="command",required=True)
    sub.add_parser("verify");sub.add_parser("catalog")
    prepare=sub.add_parser("prepare")
    prepare.add_argument("--photo",type=Path,required=True)
    prepare.add_argument("--genre",required=True)
    prepare.add_argument("--variant",choices=["male","female","M","F"],required=True)
    prepare.add_argument("--out",type=Path)
    args=parser.parse_args()
    if args.command=="verify": result=verify()
    elif args.command=="catalog":
        c=json.loads((ROOT/"prompts/recipes.json").read_text(encoding="utf-8"))
        result=[{"id":r["id"],"title":r["title"],"png":r["png"]} for r in c["recipes"]]
    else:
        from stella_polza import Catalog
        p=Catalog(ROOT).prepare(args.genre,args.variant,args.photo)
        result={"genre":p.genre_id,"variant":p.variant,"prompt":p.prompt,"promptSha256":p.prompt_sha256,"photoSha256":p.photo_sha256,"cleanplateSha256":p.cleanplate_sha256,"model":"bytedance/seedream-5-lite","quality":"basic","aspectRatio":"16:9","networkRequests":0}
        if args.out:
            args.out.parent.mkdir(parents=True,exist_ok=True)
            with args.out.open("x",encoding="utf-8") as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=="__main__":
    try: main()
    except Exception as exc:
        # Avoid printing private file contents, payloads, or credentials.
        print(json.dumps({"status":"failed","errorType":type(exc).__name__}),file=sys.stderr)
        sys.exit(1)

