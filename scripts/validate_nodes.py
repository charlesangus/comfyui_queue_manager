import argparse
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
from unittest.mock import patch


def load_node_returns(repo_path: Path) -> dict[str, tuple[str, ...]]:
    package_path = repo_path.resolve() / "src" / "comfyui_queue_manager"
    package_name = "_queue_manager_node_metadata"
    package = ModuleType(package_name)
    package.__path__ = [str(package_path)]
    server = ModuleType("server")
    server.PromptServer = type("PromptServer", (), {})

    # Importing the extension entry point initializes ComfyUI queue hooks and HTTP routes.
    with patch.dict(sys.modules, {package_name: package, "server": server}):
        spec = importlib.util.spec_from_file_location(f"{package_name}.nodes", package_path / "nodes.py")
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load node metadata from {package_path}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        mappings = module.NODE_CLASS_MAPPINGS
        if not mappings:
            raise ValueError(f"No node mappings found in {package_path}")
        return {name: tuple(getattr(node, "RETURN_TYPES", ())) for name, node in mappings.items()}


def compare_node_returns(base: dict[str, tuple[str, ...]], proposed: dict[str, tuple[str, ...]]) -> list[str]:
    changes = []
    for name, returns in base.items():
        if name not in proposed:
            changes.append(f"{name}: node removed")
        elif proposed[name][:len(returns)] != returns:
            changes.append(f"{name}: return types changed or removed ({returns!r} -> {proposed[name]!r})")
    return changes


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Queue Manager node return compatibility without starting ComfyUI.")
    parser.add_argument("base_repo", type=Path)
    parser.add_argument("pr_repo", type=Path)
    args = parser.parse_args()

    changes = compare_node_returns(load_node_returns(args.base_repo), load_node_returns(args.pr_repo))
    if changes:
        print("Breaking changes detected:")
        print("\n".join(changes))
        return 1
    print("No breaking changes detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
