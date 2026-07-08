# Surge Suite

Surge Suite is a face recognition-powered productivity platform that enables secure, passwordless authentication through facial biometrics. The application identifies registered users in real time and grants access to their personalized workspace without relying on conventional credentials.

Built for both personal and shared environments, Surge Suite supports multiple registered users on a single device while ensuring complete separation of user data. When an unrecognized face is detected, the application initiates a registration process to create a new user profile and securely associate facial embeddings with that account.

The current release provides every authenticated user with a private workspace consisting of a notes application and a task management system. An integrated Retrieval-Augmented Generation (RAG) pipeline enables intelligent retrieval of notes and contextual assistance, making information easier to locate and utilize.

---

## Features

- Face-based user registration and authentication
- Passwordless login through real-time facial recognition
- Personalized workspaces for individual users
- Secure multi-user support on a single device
- Private notes management
- To-do list and task management
- AI-assisted note retrieval using a Retrieval-Augmented Generation (RAG) pipeline
- Automatic recognition of returning users
- JSON-based storage fallback for improved resilience

---

## Technology Stack

### Frontend
- React

### Backend
- Django
- Django REST Framework

### Database
- MongoDB
- JSON storage fallback

### Computer Vision
- OpenCV
- MTCNN
- RetinaFace
- SSD

### Artificial Intelligence
- Retrieval-Augmented Generation (RAG)

---

## System Architecture

Surge Suite follows a client-server architecture consisting of a React frontend, a Django REST backend, MongoDB for persistent storage, and a computer vision pipeline responsible for authentication.

Upon launching the application, the webcam initializes and begins processing video frames. Facial detection is performed using OpenCV alongside MTCNN, RetinaFace, and SSD-based detection models. If a registered user is recognized, authentication is completed automatically and the corresponding workspace is loaded. If no matching profile is found, the user is prompted to register by providing a name and facial data.

The backend exposes RESTful APIs responsible for authentication, workspace management, notes, tasks, and AI-powered retrieval. MongoDB stores user information and workspace data, while a JSON-based storage mechanism serves as a fallback when database connectivity is unavailable. The integrated RAG pipeline enables semantic retrieval of stored notes and contextual information.

---

## Installation

### Clone the Repository

```bash
git clone https://github.com/abhinavAryan47/surge-suite.git
cd surge-suite
```

### Backend Setup

```bash
cd backend

python -m venv venv

source venv/bin/activate
# Windows
# venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate

python manage.py runserver
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

---

## Project Structure

```
surge-suite/
│
├── backend/
│   ├── Authentication Services
│   ├── Face Recognition Pipeline
│   ├── REST API
│   ├── RAG Services
│   └── Database Models
│
├── frontend/
│   ├── React Application
│   ├── Components
│   ├── Pages
│   └── Assets
│
├── database/
│
├── requirements.txt
│
└── README.md
```

---

## Future Enhancements

The long-term vision for Surge Suite is to evolve into a comprehensive productivity platform centered around biometric authentication and intelligent collaboration.

Planned enhancements include:

- Rich text document editor with functionality comparable to modern word processors
- Spreadsheet application for calculations, data analysis, and tabular information management
- Peer-to-peer real-time collaboration on documents, notes, and spreadsheets
- Cross-organization collaboration with secure workspace sharing and access control
- Organization management with role-based permissions and dedicated team workspaces
- AI-powered document search, summarization, and contextual assistance
- Version history and document recovery
- End-to-end encrypted cloud synchronization
- Cross-device synchronization
- Mobile application support

---

## License

## License

This project is licensed under the Apache License 2.0. You may use, modify, and distribute this software in accordance with the terms of the license. A copy of the license is available in the `LICENSE` file at the root of this repository.
