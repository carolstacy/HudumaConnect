 HudumaConnect — Public Service Request System

HudumaConnect is a web-based public service request system designed to help citizens report community issues and track the progress of their service requests through a simple, user-friendly interface.

The project demonstrates how technology can improve communication between citizens and public service administrators by providing a centralized platform for submitting, reviewing, and managing requests.

Note: HudumaConnect is an academic demonstration project and is not an official Kenyan government website or service.

 Features

 Citizen Portal
- Responsive homepage with a clean, accessible interface.
- Browse public service categories.
- Submit requests with personal contact details, location, category, and issue description.
- Generate a unique reference number for each submitted request.
- Track request status using the reference number.
- View requests submitted during the current browser session.

Admin Dashboard
- View submitted service requests.
- Monitor total, pending, in-progress, and resolved requests.
- Search requests by reference number, name, location, category, or email.
- Filter requests by status.
- Update request statuses.

 Service Categories
- Roads and Transport
- Water and Sanitation
- Waste Management
- Street Lighting
- Public Facilities
- Other Services

 Technologies Used

- React — User interface and application components.
- Vite — Development server and build tool.
- JavaScript — Application logic and interactivity.
- CSS — Styling and responsive layouts.
- Git and GitHub — Version control and source code hosting.
- Firebase— Planned backend integration for persistent data storage and authentication.

Getting Started

 Prerequisites

Install the following software before running the project:

- [Node.js](https://nodejs.org/) — includes npm.
- [Git](https://git-scm.com/).
- [Visual Studio Code](https://code.visualstudio.com/) or another code editor.

 Installation

1. Clone the repository:

   bash
   git clone https://github.com/carolstacy/HudumaConnect.git
   

2. Navigate to the project directory:

   bash
   cd HudumaConnect


3. Install dependencies:
bash
   npm install
  

4. Start the development server:

  bash
   npm run dev
  

5. Open the local URL displayed in your terminal, usually:

   `http://localhost:5173`

 Available Commands

| Command | Description |
|---|---|
| `npm run dev' | Starts the development server. |
| `npm run build` | Builds the application for production. |
| `npm run preview` | Previews the production build locally. |

Project Structure

text
HudumaConnect/
├── public/
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md


*Note: The exact folders and files may vary depending on the current project setup.*

 How to Use

1. Open the application in your browser.
2. Browse the available public service categories.
3. Select *Report an Issue* or choose a service category.
4. Complete the request form and submit it.
5. Copy the generated reference number.
6. Use the tracking section to check the request status.
7. Open the demonstration Admin Dashboard to review requests and update their statuses.

 Current Limitations

This version is a functional front-end demonstration with the following limitations:

- Requests are stored in React application state and are cleared when the page is refreshed.
- The admin dashboard toggle is for demonstration only and does not provide secure administrator authentication.
- Requests are not yet stored in a persistent database.
- The optional attachment selection does not upload files to a server.
- Email notifications and integration with official government systems are not implemented.

 Future Improvements

Planned enhancements include:

- Firebase Firestore integration for persistent request storage.
- Firebase Authentication for citizen and administrator accounts.
- Role-based access control and secure database rules.
- Secure file uploads using Firebase Storage.
- Persistent request tracking across sessions and devices.
- Request notifications and administrative reporting.
- Deployment to a public hosting platform.

 Security and Privacy

The current version is intended for development and demonstration purposes. Do not submit real citizens' personal information or sensitive documents.

Before production use, the system should implement secure authentication, server-side authorization, appropriate database access rules, input validation, and privacy protections.

 Author

Caroline Ndeti

Information Technology Project

HudumaConnect — Public Service Request System

 License

This project is developed for educational and demonstration purposes. A formal open-source license can be added if the project is intended for public reuse.
