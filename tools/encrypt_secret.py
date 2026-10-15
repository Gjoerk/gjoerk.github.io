"""Encrypts the secret project list for the landing page into secret.json.

Usage: python tools/encrypt_secret.py projects.json
projects.json is a list of {"name", "href", "description", "icon"} objects.
Keep that file out of the repository, otherwise the list is public.
The password is asked for interactively.
"""
import base64
import getpass
import json
import os
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 310_000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "secret.json")


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        projects = json.load(f)
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat: "):
        sys.exit("Passwords do not match.")

    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(password.encode())
    data = AESGCM(key).encrypt(iv, json.dumps(projects, ensure_ascii=False).encode(), None)

    b64 = lambda b: base64.b64encode(b).decode()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"iterations": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "data": b64(data)}, f, indent=2)
        f.write("\n")
    print(f"Wrote {os.path.normpath(OUT)} with {len(projects)} project(s).")


if __name__ == "__main__":
    main()
