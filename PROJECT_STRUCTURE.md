# CJ-AI Project Structure

## Overview
This project is a full-stack application with a Python FastAPI backend and a React frontend.

```
CJ-AI/
├── .venv/                              # Python virtual environment
├── backend/                            # Backend application (Python/FastAPI)
│   └── app/
│       ├── __pycache__/                # Python cache files
│       ├── main.py                     # FastAPI application entry point
│       ├── run.py                      # Application runner script
│       ├── requirements.txt            # Python dependencies
│       ├── models/
│       │   ├── __pycache__/
│       │   └── schemas.py              # Pydantic models/schemas
│       ├── routes/
│       │   ├── __pycache__/
│       │   └── chat.py                 # Chat-related API routes
│       └── services/
│           ├── __pycache__/
│           └── llm_service.py          # LLM integration service
├── frontend/                           # Frontend application (React)
│   ├── public/                         # Static assets
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   └── (other static files)
│   ├── src/                            # React source code
│   │   ├── App.css                     # App component styles
│   │   ├── App.jsx                     # Main React component
│   │   ├── index.css                   # Global styles
│   │   ├── main.jsx                    # React entry point
│   │   └── assets/                     # Image and media assets
│   │       ├── hero.png
│   │       ├── react.svg
│   │       └── vite.svg
│   ├── .gitignore                      # Git ignore rules
│   ├── eslint.config.js                # ESLint configuration
│   ├── index.html                      # HTML template
│   ├── package.json                    # NPM dependencies and scripts
│   ├── package-lock.json               # NPM lock file
│   ├── README.md                       # Frontend documentation
│   ├── tailwind.config.js              # Tailwind CSS configuration
│   ├── vite.config.js                  # Vite bundler configuration
│   └── node_modules/                   # NPM packages (installed dependencies)
```

## Directory Details

### Backend (`backend/app/`)
- **main.py**: Core FastAPI application setup and initialization
- **run.py**: Script to run the FastAPI server
- **requirements.txt**: Python package dependencies
- **models/**: Data models and schemas
  - **schemas.py**: Pydantic models for data validation
- **routes/**: API route handlers
  - **chat.py**: Chat endpoint handlers
- **services/**: Business logic services
  - **llm_service.py**: LLM (Language Model) integration and operations

### Frontend (`frontend/`)
- **src/**: React application source
  - **App.jsx**: Main application component
  - **main.jsx**: Application entry point
  - **index.css**: Global styles
  - **App.css**: App component styles
  - **assets/**: Images and static assets
- **public/**: Public static files served as-is
- **Configuration Files**:
  - **vite.config.js**: Vite build tool configuration
  - **tailwind.config.js**: Tailwind CSS framework configuration
  - **eslint.config.js**: ESLint linting rules
  - **package.json**: Project metadata and dependencies
  - **index.html**: HTML template

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Data Validation**: Pydantic
- **LLM Integration**: Custom LLM service

### Frontend
- **Framework**: React
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Code Quality**: ESLint

## Key Features
- Chat interface with API backend
- LLM service integration
- React-based user interface
- FastAPI REST API
