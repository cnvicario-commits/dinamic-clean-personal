#!/usr/bin/env python3
"""Hold an exclusive flock until the child command exits.

The lock file is not deleted. The kernel releases it when this process
ends, including after SIGKILL. A second process fails before it starts
the command.
"""
import fcntl
import os
import subprocess
import sys

if len(sys.argv) < 3:
    print("OPERATION_REJECTED usage", file=sys.stderr)
    raise SystemExit(2)

lock_path = sys.argv[1]
command = sys.argv[2:]
os.makedirs(os.path.dirname(lock_path), exist_ok=True)
fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
try:
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    print("OPERATION_REJECTED locked", file=sys.stderr)
    raise SystemExit(1)

raise SystemExit(subprocess.call(command))
