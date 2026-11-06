#!/usr/bin/env python3
"""Drive real Firefox with the Firefox build loaded, for testing the theme.

    tools/.venv/bin/python tools/ffdrive.py serve         # start (keeps running)
    tools/.venv/bin/python tools/ffdrive.py '<json>'      # send one command

The server opens Firefox with a dedicated profile (sign in to Gmail there
once; it's remembered) and installs dist/haiku-theme-for-gmail-firefox/ as a
temporary add-on. Run tools/build.py first.

Commands (JSON object, one per call):
  {"nav": "https://mail.google.com/mail/u/0/#inbox"}
  {"js": "return document.title"}            run JavaScript in the page
  {"click": [x, y]}  {"hover": [x, y]}        real pointer input, CSS px
  {"drag": [x1, y1, x2, y2]}                  press, move, release
  {"dblclick": [x, y]}
  {"type": "text"}   {"key": "Enter"}         keyboard input (Escape, Tab...)
  {"shot": "/path/out.png"}                   screenshot of the page area
  {"size": [width, height]}                   set the window size
  {"reload": true}                            reinstall the add-on (after a build)
  {"tabs": true}  {"switch": handle}  {"close_others": true}
  {"quit": true}
Results are printed as JSON. Exchange files live in $TMPDIR/haiku-ff.
"""
import json
import pathlib
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
ADDON = ROOT / "dist" / "haiku-theme-for-gmail-firefox"
PROFILE = pathlib.Path.home() / ".cache" / "haiku-theme-firefox-profile"
WORK = pathlib.Path(tempfile.gettempdir()) / "haiku-ff"
KEYS = {"Enter": "", "Escape": "", "Tab": "", "Backspace": "",
        "Delete": "", "Down": "", "Up": "", "Left": "", "Right": ""}


def serve():
    from selenium import webdriver
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.firefox.options import Options

    WORK.mkdir(exist_ok=True)
    PROFILE.mkdir(parents=True, exist_ok=True)
    opts = Options()
    opts.add_argument("-profile")
    opts.add_argument(str(PROFILE))
    driver = webdriver.Firefox(options=opts)
    addon = driver.install_addon(str(ADDON), temporary=True)
    driver.get("https://mail.google.com/mail/u/0/#inbox")
    print("ready", flush=True)

    def run(cmd):
        nonlocal addon
        if "nav" in cmd:
            driver.get(cmd["nav"])
            return {"url": driver.current_url}
        if "js" in cmd:
            return {"value": driver.execute_script(cmd["js"])}
        if "click" in cmd or "hover" in cmd:
            x, y = cmd.get("click") or cmd.get("hover")
            chain = ActionChains(driver).move_by_offset(0, 0)
            body = driver.find_element("tag name", "body")
            # Absolute viewport position: offset from the body's top-left.
            r = driver.execute_script("const r=document.body.getBoundingClientRect();return [r.left,r.top,r.width,r.height]")
            chain = ActionChains(driver).move_to_element_with_offset(body, int(x - r[0] - r[2] / 2), int(y - r[1] - r[3] / 2))
            if "click" in cmd:
                chain = chain.click()
            chain.perform()
            return {"ok": True}
        if "drag" in cmd or "dblclick" in cmd:
            body = driver.find_element("tag name", "body")
            r = driver.execute_script("const r=document.body.getBoundingClientRect();return [r.left,r.top,r.width,r.height]")
            at = lambda x, y: (int(x - r[0] - r[2] / 2), int(y - r[1] - r[3] / 2))
            if "dblclick" in cmd:
                ActionChains(driver).move_to_element_with_offset(body, *at(*cmd["dblclick"])).double_click().perform()
                return {"ok": True}
            x1, y1, x2, y2 = cmd["drag"]
            chain = ActionChains(driver).move_to_element_with_offset(body, *at(x1, y1)).click_and_hold()
            for i in range(1, 6):  # several steps, like a real drag
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
        if "size" in cmd:
            driver.set_window_size(*cmd["size"])
            return {"viewport": driver.execute_script("return [innerWidth, innerHeight]")}
        if "tabs" in cmd:
            cur = driver.current_window_handle
            out = []
            for h in driver.window_handles:
                driver.switch_to.window(h)
                out.append({"handle": h, "title": driver.title[:60], "visible": driver.execute_script("return document.visibilityState")})
            driver.switch_to.window(cur)
            return {"current": cur, "tabs": out}
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
            driver.uninstall_addon(addon)
            addon = driver.install_addon(str(ADDON), temporary=True)
            driver.refresh()
            return {"reloaded": addon}
        return {"error": "unknown command"}

    while True:
        q = WORK / "cmd.json"
        if q.exists():
            try:
                cmd = json.loads(q.read_text())
                q.unlink()
                if cmd.get("quit"):
                    (WORK / "result.json").write_text(json.dumps({"bye": True}))
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
