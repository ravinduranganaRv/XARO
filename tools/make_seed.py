"""Create the owner login that ships with the site.
Usage:  python3 tools/make_seed.py "YourNewStrongPassword"   (then python3 build.py, commit, push)
Only a salted PBKDF2-SHA256 hash is written to src/mod/seed_admin.json; the password itself is never stored."""
import sys, os, hashlib, json, pathlib
if len(sys.argv) != 2 or len(sys.argv[1]) < 10:
    sys.exit('Give a password of at least 10 characters (use a long phrase).')
salt, it = os.urandom(16), 120000
h = hashlib.pbkdf2_hmac('sha256', sys.argv[1].encode(), salt, it, 32).hex()
out = pathlib.Path(__file__).parent.parent / 'src/mod/seed_admin.json'
out.write_text(json.dumps({'salt': salt.hex(), 'hash': h, 'iter': it}))
print('wrote', out)
