"""Can the Poller still read new-format comments? Runs the real jira_poller code
(path given as argv[1]) against ADF shaped like the proposed agent notes."""
import importlib.util, sys

sys.path.insert(0, sys.argv[2])  # the reflex-platform src root

spec = importlib.util.spec_from_file_location("jp", sys.argv[1])
jp = importlib.util.module_from_spec(spec)
sys.modules["jp"] = jp
spec.loader.exec_module(jp)

def t(s, marks=None):
    n = {"type": "text", "text": s}
    if marks:
        n["marks"] = marks
    return n

def p(*nodes):
    return {"type": "paragraph", "content": list(nodes)}

def link(s, url):
    return t(s, [{"type": "link", "attrs": {"href": url}}])

PR = "https://github.com/CondecoByEptura/Connect-AccountService/pull/145"
SIG = "This comment is posted by agent-platform-code-review"

review = {"type": "doc", "version": 1, "content": [
    {"type": "panel", "attrs": {"panelType": "warning"}, "content": [
        p(t("Blocked", [{"type": "strong"}]), t(" · Argus (review) · 2 questions need an answer")),
        p(t("Code looks correct at 78a466a."))]},
    {"type": "table", "content": [
        {"type": "tableRow", "content": [
            {"type": "tableHeader", "content": [p(t("PR"))]},
            {"type": "tableHeader", "content": [p(t("Needs you"))]}]},
        {"type": "tableRow", "content": [
            {"type": "tableCell", "content": [p(link("AccountService#145", PR))]},
            {"type": "tableCell", "content": [p({"type": "status", "attrs": {"text": "2 OPEN", "color": "yellow"}})]}]}]},
    {"type": "heading", "attrs": {"level": 4}, "content": [t("To continue")]},
    {"type": "orderedList", "content": [
        {"type": "listItem", "content": [p(t("Does the Scheduler mail AccountData.Users? Default: yes"))]}]},
    p({"type": "mention", "attrs": {"id": "abc", "text": "@Avinash Shukla"}}),
    {"type": "expand", "attrs": {"title": "Details"}, "content": [
        p(t("Needs-human 1: AccountManager.cs:668 scheduler contract")),
        p(t("verified: 78a466a51bcf1956187e6d6b2bb3a05512195946"))]},
    {"type": "nestedExpand", "attrs": {"title": "More"}, "content": [p(t("nested detail line"))]},
    p({"type": "inlineCard", "attrs": {"url": PR}}),
    p(t("COPILOT_REVIEW_COMPLETE: BLOCKED — 2 needs-human on Connect-AccountService#145")),
    p(t("COPILOT_FINDINGS: actionable=0; noise=0; needs-human=2")),
    p(t(SIG, [{"type": "textColor", "attrs": {"color": "#97a0af"}}]))]}

codegen = {"type": "doc", "version": 1, "content": [
    {"type": "panel", "attrs": {"panelType": "success"}, "content": [p(t("Passed · Forge (code) · PR opened"))]},
    {"type": "expand", "attrs": {"title": "Details"}, "content": [
        p(t("Final Requirements Snapshot")), p(t("PR: "), link(PR, PR))]},
    p(t("REPO_CODEGEN: Connect-AccountService PR_CREATED "), link(PR, PR)),
    p(t("CODEGEN_PR_SET: READY")),
    p(t("This comment is posted by agent-platform-code-implementation"))]}

text = jp.adf_to_text(review)
print("---- flattened review note ----")
print(text)
results = []
def check(name, ok):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name)

check("panel headline readable", "Blocked · Argus (review)" in text)
check("text inside expand readable", "AccountManager.cs:668" in text and "verified: 78a466a" in text)
check("text inside nestedExpand readable", "nested detail line" in text)
check("table link text readable", "AccountService#145" in text)
check("status lozenge text readable", "2 OPEN" in text)
check("mention readable", "@Avinash Shukla" in text)
check("inlineCard (smart link) URL readable", PR in text)
check("marker line found", bool(list(jp.marker_lines("COPILOT_REVIEW_COMPLETE: BLOCKED", [text]))))
check("findings marker found", bool(list(jp.marker_lines("COPILOT_FINDINGS:", [text]))))
cg = jp.adf_to_text(codegen)
check("PR_CREATED line matched", bool(jp.PR_CREATED_RE.search(cg)))
check("snapshot inside Details readable", "Final Requirements Snapshot" in cg)

has_bot = hasattr(jp, "is_bot_comment")
human = "ANSWERS: Q1: default · Q2: A"
if has_bot:
    check("signature-last note is a bot comment", jp.is_bot_comment(text))
    check("human ANSWERS reply is not a bot comment", not jp.is_bot_comment(human))
replies = jp.findings_for_revision("COPILOT_FINDINGS:", [human, text])
joined = "\n".join(replies)
check("revise input = report + human reply", human in joined and "AccountManager.cs:668" in joined)
older_bot = "Some earlier agent note\n" + SIG
replies2 = jp.findings_for_revision("COPILOT_FINDINGS:", [older_bot.replace("Some earlier", "A newer"), text])
check("newer signature-last bot note NOT taken as a human ruling",
      not any("A newer agent note" in r for r in replies2))
print(f"\n{sum(ok for _, ok in results)}/{len(results)} passed")
