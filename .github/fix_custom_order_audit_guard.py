from pathlib import Path

path = Path('.github/apply_custom_order_final_audit.py')
source = path.read_text()
old = r"""assert.doesNotMatch(runtime.match(/function firstReviewIssue\(\)[\s\S]*?\n    }\n\n    function openReview/)?.[0] || '', /validateConfiguration\(root\)/, 'Review validation must not mutate the Product Options finish gate');"""
new = """const firstReviewIssueStart = runtime.indexOf('function firstReviewIssue()');
const openReviewStart = runtime.indexOf('function openReview()');
assert.ok(firstReviewIssueStart >= 0 && openReviewStart > firstReviewIssueStart, 'Review validation source boundaries must be discoverable');
assert.doesNotMatch(runtime.slice(firstReviewIssueStart, openReviewStart), /validateConfiguration\\(root\\)/, 'Review validation must not mutate the Product Options finish gate');"""
if source.count(old) != 1:
    raise SystemExit(f'expected one problematic Review guard, found {source.count(old)}')
path.write_text(source.replace(old, new, 1))
