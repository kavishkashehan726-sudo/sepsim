"""Build the SEPSim VM trace kit (a folder + zip) from the test programs in this directory.

Usage: python make_kit.py <output-dir>
"""
import os
import re
import shutil
import sys
import zipfile

from sepasm import assemble, to_mem

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CLOCKS = 400
ARCHITECTURES = {"acc": "101"}  # Stack (110) programs are added once its ISA document arrives


def crlf(text):
    return text.replace("\r\n", "\n").replace("\n", "\r\n")


def build(out_root):
    kit = os.path.join(out_root, "sepsim-trace-kit")
    shutil.rmtree(kit, ignore_errors=True)
    for sub in ("mem", "programs", "extra", "assembler-check"):
        os.makedirs(os.path.join(kit, sub))

    manifest = ["# name machine clocks"]
    for arch, machine in ARCHITECTURES.items():
        src_dir = os.path.join(HERE, "programs", arch)
        for fn in sorted(os.listdir(src_dir)):
            if not fn.endswith(".prg"):
                continue
            name = fn[:-4]
            source = open(os.path.join(src_dir, fn), encoding="latin-1").read()
            data, clocks = {}, DEFAULT_CLOCKS
            for m in re.finditer(r"//@data\s+(\S+)\s+(\S+)", source):
                data[int(m.group(1), 0)] = int(m.group(2), 0)
            m = re.search(r"//@clocks\s+(\d+)", source)
            if m:
                clocks = int(m.group(1))
            with open(os.path.join(kit, "mem", name + ".mem"), "w", newline="") as f:
                f.write(to_mem(assemble(source), data))
            with open(os.path.join(kit, "programs", fn), "w", newline="") as f:
                f.write(crlf(source))
            manifest.append(f"{name} {machine} {clocks}")

    with open(os.path.join(kit, "manifest.txt"), "w", newline="") as f:
        f.write(crlf("\n".join(manifest) + "\n"))
    for fn in os.listdir(os.path.join(HERE, "kit")):
        with open(os.path.join(HERE, "kit", fn), newline="") as src, \
                open(os.path.join(kit, fn), "w", newline="") as dst:
            dst.write(crlf(src.read()))
    for fn in sorted(os.listdir(os.path.join(HERE, "assembler-check"))):
        with open(os.path.join(HERE, "assembler-check", fn), newline="") as src, \
                open(os.path.join(kit, "assembler-check", fn), "w", newline="") as dst:
            dst.write(crlf(src.read()))
    with open(os.path.join(HERE, "README.txt"), newline="") as src, \
            open(os.path.join(kit, "README.txt"), "w", newline="") as dst:
        dst.write(crlf(src.read()))
    with open(os.path.join(kit, "extra", "put-your-mem-files-here.txt"), "w", newline="") as f:
        f.write("Copy any .mem files you want recorded (Accumulator) into this folder.\r\n")

    zip_path = os.path.join(out_root, "sepsim-trace-kit.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(kit):
            for fn in files:
                full = os.path.join(root, fn)
                z.write(full, os.path.relpath(full, out_root))
    return zip_path


if __name__ == "__main__":
    print(build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "dist")))
