#!/usr/bin/env python3
"""Drive a separate Chromium with the development build loaded, for testing.

    tools/.venv/bin/python tools/crdrive.py serve        # start (keeps running)
    tools/.venv/bin/python tools/crdrive.py '<json>'     # send one command

The Chrome counterpart of ffdrive.py, with the same commands. The server
starts Chromium with a dedicated profile (sign in to Gmail there once; it's
remembered) and this folder loaded unpacked - the dev build, so
tools/devserver.py hot-reloads it - then attaches Selenium over Chromium's
debugging port. Input is synthetic (WebDriver), never the real pointer or
keyboard.

Commands (JSON object, one per call):
  {"nav": "https://mail.google.com/mail/u/0/#inbox"}
  {"js": "return document.title"}            run JavaScript in the page
  {"click": [x, y]}  {"hover": [x, y]}        pointer input, CSS px
  {"drag": [x1, y1, x2, y2]}  {"dblclick": [x, y]}
  {"type": "text"}   {"key": "Enter"}         keyboard input (Escape, Tab...)
  {"shot": "/path/out.png"}                   screenshot of the page area
  {"reload": true}                            reload the extension + page
  {"tabs": true}  {"switch": handle}  {"close_others": true}
  {"newtab": "https://..."}                   open a tab (switches to it)
  {"quit": true}
Results are printed as JSON. Exchange files live in $TMPDIR/haiku-cr.

Environment:
  CR_BINARY    Chromium to run (default /usr/bin/chromium)
  CR_APPID     window app id via --class (e.g. haiku-test-chrome)
  CR_SCALE     --force-device-scale-factor (e.g. 1.5)
  CR_LAUNCHER  command that starts the browser for us, e.g. one that tells
               the window manager where to put the window (the Chromium
               command line is appended). Without it, it's started directly.
"""
import json
import os
import pathlib
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROFILE = pathlib.Path.home() / ".cache" / "haiku-theme-chromium-profile"
WORK = pathlib.Path(tempfile.gettempdir()) / "haiku-cr"
PORT = int(os.environ.get("CR_PORT", "9333"))
INBOX = "https://mail.google.com/mail/u/0/#inbox"
KEYS = {"Enter": "", "Escape": "", "Tab": "", "Backspace": "",
        "Delete": "", "Down": "", "Up": "", "Left": "", "Right": ""}


def debug_port_up():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def start_browser():
    cmd = [
        os.environ.get("CR_BINARY", "/usr/bin/chromium"),
        f"--user-data-dir={PROFILE}",
        f"--remote-debugging-port={PORT}",
        "--no-first-run", "--no-default-browser-check",
        f"--load-extension={ROOT}",
        "--disable-features=DisableLoadExtensionCommandLineSwitch",
    ]
    if os.environ.get("CR_APPID"):
        cmd.append(f"--class={os.environ['CR_APPID']}")
    if os.environ.get("CR_SCALE"):
        cmd.append(f"--force-device-scale-factor={os.environ['CR_SCALE']}")
    cmd.append(INBOX)
    launcher = os.environ.get("CR_LAUNCHER")
    if launcher:
        subprocess.run([*shlex.split(launcher), *cmd], check=True)
    else:
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(150):
        if debug_port_up():
            return
        time.sleep(0.2)
    sys.exit(f"Chromium's debugging port {PORT} never came up")


def serve():
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.action_chains import ActionChains

    WORK.mkdir(exist_ok=True)
    PROFILE.mkdir(parents=True, exist_ok=True)
    if not debug_port_up():
        start_browser()
    opts = Options()
    opts.debugger_address = f"127.0.0.1:{PORT}"
    driver_bin = "/usr/bin/chromedriver"
    service = Service(executable_path=driver_bin) if os.path.exists(driver_bin) else Service()
    driver = webdriver.Chrome(service=service, options=opts)
    # Work in the Gmail tab.
    for h in driver.window_handles:
        driver.switch_to.window(h)
        if "mail.google.com" in driver.current_url:
            break
    print("ready", flush=True)

    def body_rect():
        return driver.execute_script("const r=document.body.getBoundingClientRect();return [r.left,r.top,r.width,r.height]")

    def run(cmd):
        if "nav" in cmd:
            driver.get(cmd["nav"])
            return {"url": driver.current_url}
        if "js" in cmd:
            return {"value": driver.execute_script(cmd["js"])}
        if "click" in cmd or "hover" in cmd:
            x, y = cmd.get("click") or cmd.get("hover")
            body = driver.find_element("tag name", "body")
            r = body_rect()
            chain = ActionChains(driver).move_to_element_with_offset(body, int(x - r[0] - r[2] / 2), int(y - r[1] - r[3] / 2))
            if "click" in cmd:
                chain = chain.click()
            chain.perform()
            return {"ok": True}
        if "drag" in cmd or "dblclick" in cmd:
            body = driver.find_element("tag name", "body")
            r = body_rect()
            at = lambda x, y: (int(x - r[0] - r[2] / 2), int(y - r[1] - r[3] / 2))
            if "dblclick" in cmd:
                ActionChains(driver).move_to_element_with_offset(body, *at(*cmd["dblclick"])).double_click().perform()
                return {"ok": True}
            x1, y1, x2, y2 = cmd["drag"]
            chain = ActionChains(driver).move_to_element_with_offset(body, *at(x1, y1)).click_and_hold()
            for i in range(1, 6):
                chain = chain.move_to_element_with_offset(body, *at(x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5))
            chain.release().perform()
            return {"ok": True}
        if "type" in cmd:
            ActionChains(driver).send_keys(cmd["type"]).perform()
            return {"ok": True}
        if "key" in cmd:
            ActionChains(driver).send_keys(KEYS.get(cmd["key"], cmd["key"])).perform()
            return {"ok": True}
        if "shot" in cmd:
            driver.save_screenshot(cmd["shot"])
            return {"saved": cmd["shot"], "viewport": driver.execute_script("return [innerWidth, innerHeight]")}
        if "tabs" in cmd:
            cur = driver.current_window_handle
            out = []
            for h in driver.window_handles:
                driver.switch_to.window(h)
                out.append({"handle": h, "title": driver.title[:60], "url": driver.current_url[:80]})
            driver.switch_to.window(cur)
            return {"current": cur, "tabs": out}
        if "newtab" in cmd:
            driver.switch_to.new_window("tab")
            driver.get(cmd["newtab"])
            return {"handle": driver.current_window_handle}
        if "switch" in cmd:
            driver.switch_to.window(cmd["switch"])
            return {"title": driver.title}
        if "close_others" in cmd:
            keep = driver.current_window_handle
            for h in driver.window_handles:
                if h != keep:
                    driver.switch_to.window(h)
                    driver.close()
            driver.switch_to.window(keep)
            return {"kept": keep}
        if "reload" in cmd:
            # Reload the unpacked extension from chrome://extensions, then
            # go back to the page that was open.
            back = driver.current_url
            driver.get("chrome://extensions")
            # Developer mode first: without it Chromium disables a reloaded
            # unpacked extension ("unsupported developer extension").
            res = driver.execute_async_script(
                """const [root, done] = arguments;
                chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, () =>
                chrome.developerPrivate.getExtensionsInfo((list) => {
                  const ext = list.find((e) => e.location === "UNPACKED" && (e.path || e.prettifiedPath || "").includes(root));
                  if (!ext) return done("not loaded");
                  const reload = () => chrome.developerPrivate.reload(ext.id, { failQuietly: true }, () => done(ext.id));
                  if (ext.state === "ENABLED") reload();
                  else chrome.management.setEnabled(ext.id, true, reload);
                }));""",
                ROOT.name,
            )
            time.sleep(1)
            driver.get(back)
            return {"reloaded": res}
        return {"error": "unknown command"}

    while True:
        q = WORK / "cmd.json"
        if q.exists():
            try:
                cmd = json.loads(q.read_text())
                q.unlink()
                if cmd.get("quit"):
                    (WORK / "result.json").write_text(json.dumps({"bye": True}))
                    try:
                        driver.execute_cdp_cmd("Browser.close", {})
                    except Exception:
                        pass
                    driver.quit()
                    return
                try:
                    res = run(cmd)
                except Exception as e:  # report, keep serving
                    res = {"error": f"{type(e).__name__}: {e}"[:600]}
                (WORK / "result.json").write_text(json.dumps(res, default=str))
            except Exception as e:
                (WORK / "result.json").write_text(json.dumps({"error": str(e)}))
        time.sleep(0.1)


def send(raw):
    WORK.mkdir(exist_ok=True)
    (WORK / "result.json").unlink(missing_ok=True)
    (WORK / "cmd.json").write_text(raw)
    for _ in range(600):
        r = WORK / "result.json"
        if r.exists() and r.stat().st_size:
            print(r.read_text())
            return
        time.sleep(0.1)
    print("no result (is the server running?)", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve()
    else:
        send(sys.argv[1])
