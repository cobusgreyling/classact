from src.builder import generate_source, _mod_name
from src.schemas import BuildSpec, MethodSpec, ArgSpec


def test_generate_parses_and_mentions_predict():
    spec = BuildSpec(
        class_name="HeadlineAgent",
        role="You write short headlines.",
        methods=[
            MethodSpec(
                name="write_headline",
                doc="Write one headline.",
                args=[ArgSpec(name="text", type="str")],
                strategy="Predict",
            )
        ],
    )
    source = generate_source(spec)
    assert "class HeadlineAgent(Agent):" in source
    assert "PredictStrategy" in source
    assert "async def write_headline(self, text: str) -> str:" in source
    assert source.strip().endswith("...")


def test_mod_name():
    assert _mod_name("HeadlineAgent") == "headline_agent"
    assert _mod_name("SupportAgent") == "support_agent"
