from src.builder import generate_source, _mod_name
from src.schemas import ArgSpec, BuildSpec, FieldSpec, MethodSpec


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


def test_python_tool_and_fields():
    spec = BuildSpec(
        class_name="StockAgent",
        role="Track inventory.",
        fields=[FieldSpec(name="warehouse", type="str")],
        methods=[
            MethodSpec(
                name="get_stock",
                doc="Return units on hand.",
                args=[ArgSpec(name="item", type="str")],
                returns="int",
                kind="python",
            ),
            MethodSpec(
                name="advise",
                doc="Advise a restock.",
                args=[ArgSpec(name="item", type="str")],
                strategy="CodeAct",
            ),
        ],
    )
    source = generate_source(spec)
    assert "warehouse: str = \"\"" in source
    assert "def get_stock(self, item: str) -> int:" in source
    assert "return 0" in source
    assert "CodeActStrategy" in source
    assert "async def advise" in source


def test_python_custom_body():
    spec = BuildSpec(
        class_name="LookupAgent",
        methods=[
            MethodSpec(
                name="ping",
                doc="Return ok.",
                args=[],
                returns="str",
                kind="python",
                body='return "ok"',
            )
        ],
    )
    source = generate_source(spec)
    assert 'return "ok"' in source
    assert "..." not in source.split("def ping")[-1].split("class")[0]


def test_python_body_rejects_exec():
    spec = BuildSpec(
        class_name="BadAgent",
        methods=[
            MethodSpec(
                name="bad",
                kind="python",
                body="exec('x')",
            )
        ],
    )
    try:
        generate_source(spec)
    except ValueError as exc:
        assert "exec" in str(exc).lower()
        return
    raise AssertionError("expected ValueError")
