"""The same packaged policy data is imported by TypeScript and Python."""
import json
import math
from importlib.resources import files

POLICY = json.loads(files("forge").joinpath("policy.json").read_text(encoding="utf-8"))
CAP = POLICY["max_unapproved_amount_eur"]
THRESHOLD = POLICY["max_drift_threshold"]
if (POLICY["schema_version"] != 1 or type(CAP) not in (int, float) or not math.isfinite(CAP) or CAP <= 0 or not float(CAP * 100).is_integer()
        or type(THRESHOLD) not in (int, float) or not 0 < THRESHOLD <= 1 or not all(POLICY[k] is True for k in
            ("cap_to_order_value", "require_verified_evidence", "filter_review_blackmail"))):
    raise ValueError("Invalid canonical policy")

def render_prompt(key):
    return POLICY[key].replace("{cap2}", f"{CAP:.2f}").replace("{cap}", str(int(CAP)) if CAP == int(CAP) else str(CAP))
