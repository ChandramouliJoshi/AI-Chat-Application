import sys
from pathlib import Path

import uvicorn


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(project_root))

    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
