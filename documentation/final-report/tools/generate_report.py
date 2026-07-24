from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]


def w(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).strip() + "\n", encoding="utf-8")


def chapter(title, body):
    return "\\chapter{" + title + "}\n" + textwrap.dedent(body).strip() + "\n"


def main():
    for folder in [
        "config", "frontmatter", "chapters", "appendices", "figures",
        "screenshots", "diagrams", "bibliography", "build"
    ]:
        (ROOT / folder).mkdir(parents=True, exist_ok=True)

    w("main.tex", r"""
        \documentclass[12pt,a4paper,oneside]{report}
        \input{config/packages}
        \input{config/commands}
        \input{config/metadata}
        \addbibresource{bibliography/references.bib}

        \begin{document}
        \pagenumbering{roman}
        \input{frontmatter/cover}
        \input{frontmatter/validation}
        \input{frontmatter/dedication}
        \input{frontmatter/acknowledgements}
        \input{frontmatter/abstract}
        \input{frontmatter/resume}
        \input{frontmatter/abbreviations}
        \tableofcontents
        \listoffigures
        \listoftables
        \clearpage
        \pagenumbering{arabic}
        \input{chapters/general-introduction}
        \input{chapters/chapter01-context}
        \input{chapters/chapter02-analysis-planning}
        \input{chapters/chapter03-requirements-architecture}
        \input{chapters/chapter04-organization-access}
        \input{chapters/chapter05-objectives-kpis-tasks}
        \input{chapters/chapter06-evaluation-hr}
        \input{chapters/chapter07-ai-analytics}
        \input{chapters/chapter08-devops}
        \input{chapters/general-conclusion}
        \appendix
        \input{appendices/api-summary}
        \input{appendices/database-dictionary}
        \input{appendices/installation-guide}
        \input{appendices/test-evidence}
        \printbibliography
        \end{document}
    """)

    w("config/packages.tex", r"""
        \usepackage[utf8]{inputenc}
        \usepackage[T1]{fontenc}
        \usepackage{lmodern}
        \usepackage[a4paper,margin=2.5cm,headheight=15pt]{geometry}
        \usepackage{setspace}
        \usepackage{graphicx}
        \usepackage{xcolor}
        \usepackage{booktabs}
        \usepackage{longtable}
        \usepackage{tabularx}
        \usepackage{array}
        \usepackage{multirow}
        \usepackage{float}
        \usepackage{caption}
        \usepackage{subcaption}
        \usepackage{pdflscape}
        \usepackage{amsmath}
        \usepackage{amssymb}
        \usepackage{tikz}
        \usetikzlibrary{arrows.meta,positioning,shapes.geometric,fit,calc}
        \usepackage{listings}
        \usepackage{enumitem}
        \usepackage{fancyhdr}
        \usepackage{titlesec}
        \usepackage{hyperref}
        \usepackage[nameinlink,noabbrev]{cleveref}
        \usepackage[backend=biber,style=ieee,sorting=none]{biblatex}
        \onehalfspacing
        \hypersetup{colorlinks=true,linkcolor=PerTrackBlue,citecolor=PerTrackGreen,urlcolor=PerTrackBlue}
        \setlist[itemize]{topsep=2pt,itemsep=2pt}
        \setlist[enumerate]{topsep=2pt,itemsep=2pt}
        \pagestyle{fancy}
        \fancyhf{}
        \lhead{\ReportShortTitle}
        \rhead{\leftmark}
        \cfoot{\thepage}
        \titleformat{\chapter}[display]{\bfseries\Huge}{\chaptername\ \thechapter}{12pt}{\Huge}
        \lstset{
          basicstyle=\ttfamily\small,
          breaklines=true,
          frame=single,
          columns=fullflexible,
          showstringspaces=false,
          tabsize=2
        }
    """)

    w("config/commands.tex", r"""
        \definecolor{PerTrackBlue}{HTML}{1D4ED8}
        \definecolor{PerTrackGreen}{HTML}{047857}
        \definecolor{PerTrackGray}{HTML}{334155}
        \definecolor{PerTrackLight}{HTML}{F8FAFC}
        \newcommand{\evidence}[1]{\textit{Evidence: \path{#1}}}
        \newcommand{\placeholder}[1]{\textbf{[TO BE COMPLETED: #1]}}
        \newcommand{\screenplaceholder}[2]{
          \begin{figure}[H]
          \centering
          \fbox{\begin{minipage}[c][5.5cm][c]{0.82\textwidth}
          \centering
          \textbf{Screenshot placeholder}\\[0.3cm]
          #2\\[0.2cm]
          The view could not be captured without a seeded, authenticated runtime session.
          \end{minipage}}
          \caption{#1. Source: screenshot to be captured from the running application.}
          \end{figure}
        }
        \newcolumntype{Y}{>{\raggedright\arraybackslash}X}
    """)

    w("config/metadata.tex", r"""
        \newcommand{\University}{\placeholder{University or engineering school}}
        \newcommand{\Degree}{\placeholder{Degree}}
        \newcommand{\Specialty}{Software Engineering and Information Systems}
        \newcommand{\AcademicYear}{2025--2026}
        \newcommand{\ReportTitle}{PerTrack: Performance Management and HR Evaluation Platform}
        \newcommand{\ReportShortTitle}{PerTrack Report}
        \newcommand{\StudentName}{\placeholder{Student name}}
        \newcommand{\HostOrganization}{\placeholder{Host organization}}
        \newcommand{\AcademicSupervisor}{\placeholder{Academic supervisor name}}
        \newcommand{\ProfessionalSupervisor}{\placeholder{Professional supervisor name}}
    """)

    w("frontmatter/cover.tex", r"""
        \begin{titlepage}
        \centering
        \vspace*{1cm}
        {\Large \University\par}
        \vspace{0.4cm}
        {\large \Degree\par}
        {\large Specialty: \Specialty\par}
        \vspace{1.5cm}
        \fbox{\begin{minipage}{0.32\textwidth}\centering University logo\\placeholder\end{minipage}}
        \hfill
        \fbox{\begin{minipage}{0.32\textwidth}\centering Host organization\\logo placeholder\end{minipage}}
        \vspace{1.8cm}

        {\Huge\bfseries \ReportTitle\par}
        \vspace{0.7cm}
        {\Large Graduation Engineering Report\par}
        \vspace{1.3cm}
        \begin{tabular}{rl}
        Student: & \StudentName\\
        Host organization: & \HostOrganization\\
        Academic supervisor: & \AcademicSupervisor\\
        Professional supervisor: & \ProfessionalSupervisor\\
        Academic year: & \AcademicYear\\
        Repository: & \texttt{application\_gestion\_competences}\\
        \end{tabular}
        \vfill
        {\large Report generated from repository evidence on July 21, 2026\par}
        \end{titlepage}
    """)

    w("frontmatter/validation.tex", r"""
        \chapter*{Report Validation Page}
        \addcontentsline{toc}{chapter}{Report Validation Page}
        This report documents the software project identified in the repository as a performance management and HR evaluation platform. The technical content was prepared from the application source code, configuration files, tests, Docker and Kubernetes manifests, AI service artifacts, and existing repository documentation.

        \vspace{1cm}
        \begin{tabularx}{\textwidth}{p{0.32\textwidth}X}
        Student name & \StudentName\\
        Academic supervisor & \AcademicSupervisor\\
        Professional supervisor & \ProfessionalSupervisor\\
        Host organization & \HostOrganization\\
        Validation date & \placeholder{Validation date}\\
        Signature & \placeholder{Signature}\\
        \end{tabularx}
        \clearpage
    """)

    w("frontmatter/dedication.tex", r"""
        \chapter*{Dedication}
        \addcontentsline{toc}{chapter}{Dedication}
        \placeholder{Personal dedication, if required by the institution.}
        \clearpage
    """)

    w("frontmatter/acknowledgements.tex", r"""
        \chapter*{Acknowledgements}
        \addcontentsline{toc}{chapter}{Acknowledgements}
        I would like to thank my academic supervisor, my professional supervisor, and everyone who contributed guidance, feedback, and review during this project. I also thank the future users represented by the business requirements of the platform: administrators, HR officers, team leaders, and collaborators. Their workflows shaped the main design choices of this performance management system.

        Several personal and institutional details were not available in the repository and are therefore kept as placeholders rather than invented.
        \clearpage
    """)

    w("frontmatter/abstract.tex", r"""
        \chapter*{Abstract}
        \addcontentsline{toc}{chapter}{Abstract}
        PerTrack is a web-based performance management and HR evaluation platform. The implemented system centralizes annual performance cycles, objective planning, KPI tracking, team and subteam organization, task follow-up, mid-year check-ins, final evaluations, HR validation, improvement plans, bonus and penalty decisions, career recommendations, analytics, audit logs, notifications, and AI-assisted review support. The repository shows a React and Vite single-page frontend, a Node.js and Express API backed by MongoDB through Mongoose, a Python Flask AI microservice using Random Forest and XGBoost artifacts, and deployment assets for Docker, Kubernetes, Kustomize, Argo CD, and GitHub Actions.

        The report analyzes the project from business, functional, architectural, implementation, security, testing, AI, and DevOps perspectives. It uses repository evidence rather than assumed functionality. The analysis highlights the main engineering challenge of the project: transforming a sensitive HR process into an auditable workflow with phase controls, role-based access, objective weight constraints, manager review, HR validation, and explicit limitations around AI-generated content and synthetic model training data.

        \textbf{Keywords:} performance management, HR evaluation, MERN stack, MongoDB, React, Express, AI-assisted review, XGBoost, Kubernetes, GitOps.
        \clearpage
    """)

    w("frontmatter/resume.tex", r"""
        \chapter*{Resume}
        \addcontentsline{toc}{chapter}{Resume}
        PerTrack est une application web de gestion de la performance et d'evaluation RH. Le systeme implemente permet de centraliser les cycles annuels, les objectifs, les KPI, les equipes, les taches, les points de suivi, les evaluations finales, la validation RH, les plans d'amelioration, les decisions de bonus ou de penalite, les recommandations de carriere, les tableaux de bord, les journaux d'audit, les notifications et certaines fonctions d'assistance par intelligence artificielle.

        Le projet repose sur une application frontend React avec Vite, une API backend Node.js et Express, une base MongoDB modelisee avec Mongoose, et un service Python Flask pour les predictions de performance. Le depot contient aussi des artefacts Docker, Kubernetes, Kustomize, Argo CD et GitHub Actions. Ce rapport presente l'analyse fonctionnelle, technique, architecturale, securite, test, IA et DevOps du projet en s'appuyant uniquement sur les elements verifies dans le depot.

        \textbf{Mots-cles:} gestion de la performance, evaluation RH, MERN, MongoDB, React, Express, intelligence artificielle, XGBoost, Kubernetes, GitOps.
        \clearpage
    """)

    w("frontmatter/abbreviations.tex", r"""
        \chapter*{List of Abbreviations and Acronyms}
        \addcontentsline{toc}{chapter}{List of Abbreviations and Acronyms}
        \begin{longtable}{p{0.22\textwidth}p{0.68\textwidth}}
        \toprule
        API & Application Programming Interface\\
        CI/CD & Continuous Integration and Continuous Delivery\\
        HR & Human Resources\\
        JWT & JSON Web Token\\
        KPI & Key Performance Indicator\\
        LLM & Large Language Model\\
        MERN & MongoDB, Express, React, Node.js\\
        RBAC & Role-Based Access Control\\
        REST & Representational State Transfer\\
        SPA & Single-Page Application\\
        XSS & Cross-Site Scripting\\
        \bottomrule
        \end{longtable}
        \clearpage
    """)

    # Diagrams
    simple_diagrams = {
        "system-context.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=1.3cm, every node/.style={font=\small}, box/.style={draw, rounded corners, fill=PerTrackLight, minimum width=3.2cm, minimum height=0.9cm, align=center}, arr/.style={-Latex, thick}]
            \node[box] (user) {Admin, HR, Team Leader, Collaborator};
            \node[box, right=2.3cm of user] (front) {React/Vite SPA};
            \node[box, right=2.3cm of front] (api) {Express API};
            \node[box, below=1.2cm of api] (db) {MongoDB};
            \node[box, above=1.2cm of api] (ai) {AI providers and Flask predictor};
            \node[box, below=1.2cm of front] (mail) {Email, calendar, uploads};
            \draw[arr] (user) -- (front);
            \draw[arr] (front) -- node[above]{REST JSON} (api);
            \draw[arr] (api) -- (db);
            \draw[arr] (api) -- (ai);
            \draw[arr] (api) -- (mail);
            \end{tikzpicture}
            \caption{System-context diagram. Source: author's own work based on repository architecture.}
            \label{fig:system-context}
            \end{figure}
        """,
        "logical-architecture.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=0.9cm, every node/.style={font=\small}, layer/.style={draw, rounded corners, fill=PerTrackLight, minimum width=11cm, minimum height=0.75cm, align=center}]
            \node[layer] (ui) {Presentation layer: React pages, route guards, dashboard shell, shared components};
            \node[layer, below=of ui] (client) {Client integration: Axios clients, token refresh, cached GET requests, API wrappers};
            \node[layer, below=of client] (api) {API layer: Express routes, validation middleware, RBAC middleware, controllers};
            \node[layer, below=of api] (domain) {Domain layer: workflow rules, objective visibility, score calculation, review context, notifications};
            \node[layer, below=of domain] (data) {Data layer: Mongoose models, MongoDB collections, local uploads};
            \node[layer, below=of data] (ops) {Operations layer: Docker images, Kubernetes manifests, GitHub Actions, Argo CD};
            \draw[-Latex, thick] (ui) -- (client);
            \draw[-Latex, thick] (client) -- (api);
            \draw[-Latex, thick] (api) -- (domain);
            \draw[-Latex, thick] (domain) -- (data);
            \draw[-Latex, thick] (data) -- (ops);
            \end{tikzpicture}
            \caption{Logical architecture. Source: author's own work based on application source code.}
            \label{fig:logical-architecture}
            \end{figure}
        """,
        "component-diagram.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=1cm, every node/.style={font=\scriptsize}, box/.style={draw, rounded corners, fill=white, minimum width=2.4cm, minimum height=0.75cm, align=center}, group/.style={draw, rounded corners, fill=PerTrackLight, inner sep=0.25cm}]
            \node[box] (routes) {Routes};
            \node[box, right=of routes] (controllers) {Controllers};
            \node[box, right=of controllers] (services) {Services and utils};
            \node[box, right=of services] (models) {Mongoose models};
            \node[box, below=of controllers] (middleware) {Auth, role, validation, audit};
            \node[box, below=of services] (ai) {AI service wrappers};
            \node[box, below=of models] (mongo) {MongoDB};
            \draw[-Latex] (routes) -- (controllers);
            \draw[-Latex] (controllers) -- (services);
            \draw[-Latex] (controllers) -- (models);
            \draw[-Latex] (services) -- (models);
            \draw[-Latex] (models) -- (mongo);
            \draw[-Latex] (middleware) -- (routes);
            \draw[-Latex] (services) -- (ai);
            \end{tikzpicture}
            \caption{Backend component diagram. Source: author's own work based on Express route and controller structure.}
            \label{fig:component-diagram}
            \end{figure}
        """,
        "database-model.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=0.75cm, every node/.style={font=\scriptsize}, ent/.style={draw, rounded corners, fill=PerTrackLight, minimum width=2.35cm, minimum height=0.7cm, align=center}]
            \node[ent] (user) {User};
            \node[ent, right=of user] (team) {Team};
            \node[ent, below=of user] (cycle) {Cycle};
            \node[ent, right=of cycle] (objective) {Objective\\embedded KPIs};
            \node[ent, right=of objective] (task) {Task};
            \node[ent, below=of objective] (checkin) {CheckIn};
            \node[ent, below=of cycle] (eval) {Evaluation};
            \node[ent, right=of eval] (final) {FinalEvaluation};
            \node[ent, right=of final] (hr) {HRDecision};
            \node[ent, below=of final] (plan) {ImprovementPlan};
            \node[ent, below=of user] (audit) [yshift=-2.4cm] {AuditLog};
            \draw[-Latex] (team) -- node[above]{leader/members} (user);
            \draw[-Latex] (objective) -- node[above]{owner} (user);
            \draw[-Latex] (objective) -- (cycle);
            \draw[-Latex] (task) -- (objective);
            \draw[-Latex] (checkin) -- (objective);
            \draw[-Latex] (eval) -- (user);
            \draw[-Latex] (eval) -- (cycle);
            \draw[-Latex] (final) -- (objective);
            \draw[-Latex] (hr) -- (final);
            \draw[-Latex] (plan) -- (final);
            \draw[-Latex] (audit) -- (user);
            \end{tikzpicture}
            \caption{Database model overview. Source: author's own work based on Mongoose schemas.}
            \label{fig:database-model}
            \end{figure}
        """,
        "deployment-architecture.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=1cm, every node/.style={font=\small}, box/.style={draw, rounded corners, fill=PerTrackLight, minimum width=2.9cm, minimum height=0.8cm, align=center}]
            \node[box] (browser) {Browser};
            \node[box, right=of browser] (nginx) {Frontend Nginx\\2 replicas in base};
            \node[box, right=of nginx] (backend) {Backend Node pod\\1 replica in base};
            \node[box, right=of backend] (mongo) {MongoDB\\external secret URI};
            \node[box, below=of backend] (secret) {backend-secret};
            \node[box, above=of backend] (registry) {Docker Hub images};
            \draw[-Latex] (browser) -- (nginx);
            \draw[-Latex] (nginx) -- node[above]{/api proxy} (backend);
            \draw[-Latex] (backend) -- (mongo);
            \draw[-Latex] (secret) -- (backend);
            \draw[-Latex] (registry) -- (nginx);
            \draw[-Latex] (registry) -- (backend);
            \end{tikzpicture}
            \caption{Deployment architecture. Source: author's own work based on Docker, Nginx, and Kubernetes manifests.}
            \label{fig:deployment-architecture}
            \end{figure}
        """,
        "cycle-state.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=1.3cm, every node/.style={font=\small}, st/.style={draw, rounded corners, fill=PerTrackLight, minimum width=2.2cm, minimum height=0.8cm, align=center}]
            \node[st] (draft) {draft};
            \node[st, right=of draft] (p1) {phase1\\in\_progress};
            \node[st, right=of p1] (p2) {phase2};
            \node[st, right=of p2] (p3) {phase3};
            \node[st, right=of p3] (closed) {closed};
            \draw[-Latex] (draft) -- node[above]{Admin sets phase1} (p1);
            \draw[-Latex] (p1) -- node[above]{only after objective readiness checks} (p2);
            \draw[-Latex] (p2) -- node[above]{approved/validated goals required} (p3);
            \draw[-Latex] (p3) -- node[above]{close cycle} (closed);
            \draw[-Latex, dashed] (p2) to[bend right=25] node[below]{admin rollback if no assessments} (p1);
            \end{tikzpicture}
            \caption{Performance-cycle state diagram. Source: author's own work based on \texttt{backend/routes/cycles.js}.}
            \label{fig:cycle-state}
            \end{figure}
        """,
        "objective-sequence.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[x=2.2cm,y=0.75cm, every node/.style={font=\scriptsize}]
            \foreach \x/\n in {0/Collaborator,1/React UI,2/Express API,3/Objective model,4/Team Leader}
              \node at (\x,0) {\n};
            \foreach \x in {0,...,4} \draw[dashed] (\x,-0.2) -- (\x,-6.2);
            \draw[-Latex] (0,-1) -- node[above]{create draft} (1,-1);
            \draw[-Latex] (1,-1.8) -- node[above]{POST /objectives} (2,-1.8);
            \draw[-Latex] (2,-2.6) -- node[above]{validate weights and scope} (3,-2.6);
            \draw[-Latex] (0,-3.4) -- node[above]{submit} (1,-3.4);
            \draw[-Latex] (1,-4.2) -- node[above]{POST submit-for-approval} (2,-4.2);
            \draw[-Latex] (2,-5.0) -- node[above]{status pending/pending\_approval} (3,-5.0);
            \draw[-Latex] (2,-5.8) -- node[above]{notify} (4,-5.8);
            \end{tikzpicture}
            \caption{Objective-submission sequence diagram. Source: author's own work based on objective routes and controller workflow.}
            \label{fig:objective-sequence}
            \end{figure}
        """,
        "evaluation-sequence.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[x=2.1cm,y=0.75cm, every node/.style={font=\scriptsize}]
            \foreach \x/\n in {0/Manager,1/API,2/Score service,3/FinalEvaluation,4/Employee}
              \node at (\x,0) {\n};
            \foreach \x in {0,...,4} \draw[dashed] (\x,-0.2) -- (\x,-5.8);
            \draw[-Latex] (0,-1) -- node[above]{generate evaluation} (1,-1);
            \draw[-Latex] (1,-1.8) -- node[above]{collect objectives} (2,-1.8);
            \draw[-Latex] (2,-2.6) -- node[above]{weighted score and evidence} (3,-2.6);
            \draw[-Latex] (0,-3.4) -- node[above]{manager edits and submits} (1,-3.4);
            \draw[-Latex] (1,-4.2) -- node[above]{pending\_hr} (3,-4.2);
            \draw[-Latex] (3,-5) -- node[above]{visible after validation} (4,-5);
            \end{tikzpicture}
            \caption{Final evaluation sequence diagram. Source: author's own work based on final evaluation controller and scoring service.}
            \label{fig:evaluation-sequence}
            \end{figure}
        """,
        "hr-review-sequence.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[x=2.1cm,y=0.75cm, every node/.style={font=\scriptsize}]
            \foreach \x/\n in {0/HR,1/API,2/Workflow rules,3/FinalEvaluation,4/Follow-up records}
              \node at (\x,0) {\n};
            \foreach \x in {0,...,4} \draw[dashed] (\x,-0.2) -- (\x,-5.8);
            \draw[-Latex] (0,-1) -- node[above]{open pending queue} (1,-1);
            \draw[-Latex] (1,-1.8) -- node[above]{check blocking issues} (2,-1.8);
            \draw[-Latex] (2,-2.6) -- node[above]{validate or return} (3,-2.6);
            \draw[-Latex] (0,-3.4) -- node[above]{decision / plan / bonus} (1,-3.4);
            \draw[-Latex] (1,-4.2) -- node[above]{create linked record} (4,-4.2);
            \draw[-Latex] (1,-5.0) -- node[above]{audit and notify} (3,-5.0);
            \end{tikzpicture}
            \caption{HR-review sequence diagram. Source: author's own work based on HR validation, decision, and improvement-plan modules.}
            \label{fig:hr-review-sequence}
            \end{figure}
        """,
        "ai-inference-sequence.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[x=2.25cm,y=0.72cm, every node/.style={font=\scriptsize}]
            \foreach \x/\n in {0/Manager UI,1/Node API,2/Review context,3/LLM provider,4/Flask predictor}
              \node at (\x,0) {\n};
            \foreach \x in {0,...,4} \draw[dashed] (\x,-0.2) -- (\x,-6.2);
            \draw[-Latex] (0,-1) -- node[above]{request draft or prediction} (1,-1);
            \draw[-Latex] (1,-1.8) -- node[above]{load scoped project data} (2,-1.8);
            \draw[-Latex] (2,-2.6) -- node[above]{compact context} (1,-2.6);
            \draw[-Latex] (1,-3.4) -- node[above]{JSON prompt} (3,-3.4);
            \draw[-Latex] (1,-4.2) -- node[above]{metrics payload} (4,-4.2);
            \draw[-Latex] (3,-5.0) -- node[above]{validated JSON/fallback} (1,-5.0);
            \draw[-Latex] (4,-5.8) -- node[above]{rating and promotion probability} (1,-5.8);
            \end{tikzpicture}
            \caption{AI inference sequence diagram. Source: author's own work based on Node AI service and Flask API.}
            \label{fig:ai-inference}
            \end{figure}
        """,
        "ci-cd-pipeline.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[node distance=0.75cm, every node/.style={font=\scriptsize}, step/.style={draw, rounded corners, fill=PerTrackLight, minimum width=2.1cm, minimum height=0.7cm, align=center}]
            \node[step] (push) {push / PR};
            \node[step, right=of push] (secrets) {Gitleaks};
            \node[step, right=of secrets] (bt) {Backend tests};
            \node[step, right=of bt] (fb) {Frontend build\\and tests};
            \node[step, below=of fb] (docker) {Docker build\\and push};
            \node[step, left=of docker] (trivy) {Trivy scans};
            \node[step, left=of trivy] (gitops) {Update dev\\Kustomize tag};
            \node[step, left=of gitops] (smoke) {Dev smoke\\health check};
            \draw[-Latex] (push) -- (secrets);
            \draw[-Latex] (secrets) -- (bt);
            \draw[-Latex] (bt) -- (fb);
            \draw[-Latex] (fb) -- (docker);
            \draw[-Latex] (docker) -- (trivy);
            \draw[-Latex] (trivy) -- (gitops);
            \draw[-Latex] (gitops) -- (smoke);
            \end{tikzpicture}
            \caption{CI/CD pipeline diagram. Source: author's own work based on GitHub Actions workflow.}
            \label{fig:ci-cd-pipeline}
            \end{figure}
        """,
        "gantt-chart.tex": r"""
            \begin{figure}[H]\centering
            \begin{tikzpicture}[x=1.05cm,y=0.65cm, every node/.style={font=\scriptsize}]
            \foreach \m/\x in {Jan/1,Feb/2,Mar/3,Apr/4,May/5,Jun/6,Jul/7} {
              \node at (\x,0) {\m};
              \draw[gray!30] (\x,-0.3) -- (\x,-8.7);
            }
            \node[anchor=east] at (0.7,-1) {Discovery};
            \node[anchor=east] at (0.7,-2) {Architecture};
            \node[anchor=east] at (0.7,-3) {Organization};
            \node[anchor=east] at (0.7,-4) {Objectives};
            \node[anchor=east] at (0.7,-5) {Evaluation};
            \node[anchor=east] at (0.7,-6) {AI/analytics};
            \node[anchor=east] at (0.7,-7) {DevOps};
            \node[anchor=east] at (0.7,-8) {Testing/report};
            \foreach \y/\a/\b in {1/1/2.2,2/1.8/3,3/2.5/4.2,4/3.1/5.2,5/4.5/6.4,6/5.4/7,7/5.8/7,8/6.2/7.4} {
              \draw[fill=PerTrackBlue!55, draw=PerTrackBlue] (\a,-\y-0.25) rectangle (\b,-\y+0.25);
            }
            \end{tikzpicture}
            \caption{Indicative project planning reconstructed from repository history and module maturity. Source: author's own work; exact internship dates are not present in the repository.}
            \label{fig:gantt-chart}
            \end{figure}
        """,
    }
    for name, content in simple_diagrams.items():
        w("diagrams/" + name, content)

    w("diagrams/use-case.tex", r"""
        \begin{figure}[H]\centering
        \begin{tikzpicture}[node distance=0.75cm, every node/.style={font=\scriptsize}, use/.style={draw, ellipse, fill=PerTrackLight, minimum width=2.5cm, align=center}, actor/.style={draw, rectangle, rounded corners, fill=white, minimum width=1.8cm, align=center}]
        \node[actor] (admin) {Admin};
        \node[actor, below=of admin] (hr) {HR};
        \node[actor, below=of hr] (tl) {Team Leader};
        \node[actor, below=of tl] (col) {Collaborator};
        \node[use, right=2cm of admin] (users) {Manage users\\and cycles};
        \node[use, right=2cm of hr] (validate) {Validate final\\evaluations};
        \node[use, right=2cm of tl] (review) {Approve goals\\and reviews};
        \node[use, right=2cm of col] (goals) {Create goals\\and check-ins};
        \node[use, right=1.4cm of review] (ai) {AI drafts\\and predictions};
        \node[use, above=of ai] (analytics) {Analytics and\\audit reports};
        \draw[-Latex] (admin) -- (users);
        \draw[-Latex] (admin) -- (analytics);
        \draw[-Latex] (hr) -- (validate);
        \draw[-Latex] (hr) -- (analytics);
        \draw[-Latex] (tl) -- (review);
        \draw[-Latex] (tl) -- (ai);
        \draw[-Latex] (col) -- (goals);
        \draw[-Latex] (col) -- (ai);
        \end{tikzpicture}
        \caption{Global use-case diagram. Source: author's own work based on routes and frontend route configuration.}
        \label{fig:use-case}
        \end{figure}
    """)

    w("diagrams/role-permission.tex", r"""
        \begin{table}[H]\centering\small
        \caption{Role-permission matrix. Source: author's own work based on backend role middleware and route configuration.}
        \label{tab:role-permission-diagram}
        \begin{tabularx}{\textwidth}{lYYYY}
        \toprule
        Capability & Admin & HR & Team leader & Collaborator\\
        \midrule
        User administration & Full & Limited lists & Managers/collaborators list & Own profile\\
        Cycle phase control & Full & View & View & View\\
        Team creation & Full & Create/update & Subteam management & View own team\\
        Objective drafting & Yes & Limited & Yes & Yes\\
        Objective approval & Yes & No direct route & Managed team & No\\
        Final evaluation & Yes & Validate/review & Generate/update & Feedback/own history\\
        Audit logs & Yes & Yes & Entity history only & No\\
        Bonus/penalty & Yes & Review & Propose/create route access & View scoped\\
        \bottomrule
        \end{tabularx}
        \end{table}
    """)

    w("diagrams/global-workflow.tex", r"""
        \begin{figure}[H]\centering
        \begin{tikzpicture}[node distance=0.85cm, every node/.style={font=\scriptsize}, step/.style={draw, rounded corners, fill=PerTrackLight, minimum width=3.1cm, minimum height=0.7cm, align=center}]
        \node[step] (login) {Authenticate and load role};
        \node[step, below=of login] (org) {Create users, teams, subteams};
        \node[step, below=of org] (cycle) {Create cycle and open phase 1};
        \node[step, below=of cycle] (goals) {Draft objectives, KPIs, tasks};
        \node[step, below=of goals] (approve) {Manager approval or revision};
        \node[step, below=of approve] (mid) {Phase 2 check-ins and mid-year review};
        \node[step, below=of mid] (final) {Phase 3 self-assessment and manager evaluation};
        \node[step, below=of final] (hr) {HR validation, return, or close};
        \node[step, below=of hr] (follow) {Improvement plan, career action, bonus/penalty};
        \foreach \a/\b in {login/org,org/cycle,cycle/goals,goals/approve,approve/mid,mid/final,final/hr,hr/follow}
          \draw[-Latex, thick] (\a) -- (\b);
        \end{tikzpicture}
        \caption{Global workflow activity diagram. Source: author's own work based on implemented modules.}
        \label{fig:global-workflow}
        \end{figure}
    """)

    w("diagrams/kpi-flow.tex", r"""
        \begin{figure}[H]\centering
        \begin{tikzpicture}[node distance=1cm, every node/.style={font=\small}, box/.style={draw, rounded corners, fill=PerTrackLight, minimum width=3cm, minimum height=0.75cm, align=center}]
        \node[box] (kpi) {KPI current/target values};
        \node[box, right=of kpi] (check) {Check-in progress};
        \node[box, right=of check] (obj) {Objective achievement};
        \node[box, below=of obj] (manager) {Manager adjustment};
        \node[box, left=of manager] (weighted) {Weighted points};
        \node[box, left=of weighted] (final) {Final score and rating};
        \draw[-Latex] (kpi) -- (check);
        \draw[-Latex] (check) -- (obj);
        \draw[-Latex] (obj) -- (manager);
        \draw[-Latex] (manager) -- (weighted);
        \draw[-Latex] (weighted) -- (final);
        \end{tikzpicture}
        \caption{KPI and scoring flow. Source: author's own work based on objective, check-in, and scoring modules.}
        \label{fig:kpi-flow}
        \end{figure}
    """)

    # Chapters
    w("chapters/general-introduction.tex", chapter("General Introduction", r"""
        Performance evaluation becomes difficult when goals, progress evidence, comments, and HR decisions are scattered across documents, spreadsheets, private messages, and late review meetings. A manager may know that an employee worked hard, but the organization needs a traceable answer to more precise questions: what objectives were agreed, which KPIs were used, who approved them, how much progress was recorded, whether the employee had a chance to assess their own work, and how HR validated the final decision. The PerTrack project addresses that operational problem by turning a sensitive annual review process into a structured web application.

        The repository shows a system built around four roles: \texttt{ADMIN}, \texttt{HR}, \texttt{TEAM\_LEADER}, and \texttt{COLLABORATOR}. These roles are not decorative labels. They control route access in the backend, menu access in the frontend, and the visibility of objectives, evaluations, HR decisions, and audit information. This is important because performance data is personal and organizationally sensitive. A collaborator should be able to draft objectives and follow their own evaluation, while a team leader should review managed employees, and HR should validate the final process without bypassing every manager-owned step.

        The application also gives special attention to objective weights. In this project, weights are not merely display values. They define how objective achievement contributes to the automatic evaluation score. A team objective is not divided by the number of members; instead, the full weight consumes capacity for every assigned member. This design is visible in both the scoring service and its tests. It prevents a shared objective from becoming artificially small when many employees participate, while still requiring the system to control the total allocation per employee and per team bucket.

        PerTrack combines a React and Vite frontend with an Express and MongoDB backend. The frontend is organized around protected routes, role-based menus, dashboards, modal workflows, charts, kanban task views, active-cycle awareness, and token refresh logic. The backend exposes REST endpoints for users, teams, cycles, objectives, check-ins, tasks, meetings, feedback, evaluations, final evaluations, HR decisions, improvement plans, career recommendations, reports, notifications, calendar integration, audit logs, and AI assistance. MongoDB is used through Mongoose schemas with references and embedded arrays, which fits the project because objectives contain KPIs, comments, activity logs, change requests, and attachments that evolve during the review lifecycle \cite{mongodbDocs,mongooseSchemas}.

        The project includes two forms of AI support. The first is generative assistance in the Node.js backend: goal suggestions, KPI suggestions, objective refinement, check-in drafts, mid-year review drafts, final self-assessment drafts, manager review drafts, and development-plan suggestions. The implementation is provider-aware and can use Gemini, xAI/Grok, or OpenAI-compatible chat completions depending on environment variables. The second is a Python Flask microservice trained on a synthetic dataset for performance rating and promotion-readiness prediction. That AI service loads saved XGBoost model artifacts, validates numeric inputs, computes a deterministic overall score, returns a predicted rating and promotion probability, and generates textual strengths, weaknesses, summaries, and suggestions. Because the dataset is synthetic, the report treats model metrics as project evidence, not as proof of real-world HR validity.

        The engineering objective of the project is therefore wider than a simple CRUD application. The system must coordinate roles, workflow phases, objective approval, team hierarchy, self-assessment, manager scoring, HR review, auditability, and deployment. The implemented DevOps assets confirm this ambition: Dockerfiles for backend and frontend, a Compose file for local containers, Kubernetes base manifests, Kustomize overlays for dev, QA, staging, and production, an Argo CD application, and a GitHub Actions workflow with secret scanning, backend tests, frontend build/tests, Docker image build and push, Trivy scans, GitOps tag update, and a health-check smoke test.

        This report follows the project from context to implementation. Chapter 1 presents the project environment and stakeholders. Chapter 2 studies the business problem, project scope, risks, and planning. Chapter 3 defines requirements and architecture. Chapters 4 to 7 follow implementation sprints covering organization/access, objectives/KPIs/tasks, evaluation/HR workflows, and AI/analytics. Chapter 8 covers testing, DevOps, deployment, and quality evidence. The report ends with limitations and realistic future work.
    """))

    w("chapters/chapter01-context.tex", chapter("General Context and Project Environment", r"""
        \section{Introduction}
        The repository does not contain the name of the university, the student, the host organization, or the supervisors. Those fields are therefore kept as placeholders. What can be verified is the nature of the software project: an HR-oriented performance management platform developed as a final-year engineering project and stored in a repository named \texttt{application\_gestion\_competences}. Several files also use names such as \texttt{pfe}, \texttt{PerTrack}, and \texttt{HR Evaluation System}. The most precise product name used in this report is PerTrack, because the repository contains PerTrack diagram files and the AI service README describes integration with the PerTrack MERN app.

        \section{Business Domain}
        The business domain is employee performance management. In practice, this domain joins administrative processes and management practice: an organization defines a cycle, employees and managers agree on objectives, progress is monitored through tasks and check-ins, managers evaluate results, and HR validates the process before decisions such as improvement plans, bonuses, penalties, promotion recommendations, or career actions are recorded.

        The project implements this domain with explicit data entities rather than informal notes. \texttt{Cycle} stores the annual review period and three phases. \texttt{Objective} stores goals, weights, KPIs, approval status, self-assessment, manager adjustment, comments, change requests, and activity logs. \texttt{FinalEvaluation} stores the automatic score, manager score, final score, rating label, objective breakdown, evidence summary, HR status, workflow history, and employee feedback. This model shows that the project is built around governance and traceability, not only dashboards.

        \section{Stakeholders and Target Users}
        \begin{table}[H]\centering\small
        \caption{Stakeholders identified from implemented roles and workflows.}
        \label{tab:stakeholders}
        \begin{tabularx}{\textwidth}{p{0.22\textwidth}p{0.28\textwidth}Y}
        \toprule
        Stakeholder & Verified role or evidence & Main expectation\\
        \midrule
        Administrator & \texttt{ADMIN} role in \texttt{User.js} and route guards & Configure users, cycles, teams, global access, analytics, audit logs, and deployment-level administration.\\
        HR officer & \texttt{HR} role in routes and final evaluation workflow & Review manager-submitted evaluations, validate or return them, create HR decisions, follow up development actions, and consult analytics.\\
        Team leader & \texttt{TEAM\_LEADER} role and access-control helpers & Manage team/subteam scope, approve objectives, review check-ins, generate evaluations, and supervise tasks.\\
        Collaborator & \texttt{COLLABORATOR} role and collaborator routes & Draft objectives, submit check-ins, perform self-assessment, view feedback, and acknowledge evaluation outputs.\\
        Academic jury & Report requirement and project documentation & Understand the engineering choices, implemented scope, limitations, tests, and deployment approach.\\
        \bottomrule
        \end{tabularx}
        \end{table}

        \section{Project Identity and Repository Evidence}
        The source tree is divided into \texttt{frontend}, \texttt{backend}, \texttt{ai-service}, \texttt{k8s}, \texttt{.github}, and several project-analysis documents. The backend package is named \texttt{backend}, and its entry point is \texttt{server.js}. The frontend package is a private Vite application. The AI service README calls the Python service an ``AI Performance Analyzer'' and mentions the PerTrack MERN app. The Kubernetes and Docker image names use \texttt{pfe}, which is consistent with a graduation-project context.

        \input{diagrams/system-context}

        \section{Development Approach}
        The repository does not contain Jira, Trello, or GitHub Projects exports. It does contain a GitHub Actions workflow, test playbooks, audit documents, and several design diagrams. From code evidence, the development approach was iterative: modules were added around progressively deeper workflows such as objectives, team weight capacity, mid-year reviews, final evaluations, HR validation, AI support, and deployment automation. The presence of test files for bugs such as objective visibility, task privacy, and scoring rules also shows that the project went through corrective cycles rather than one single static implementation.

        \section{Version Control and Quality Culture}
        Git is present in the repository, and CI is defined under \texttt{.github/workflows/docker-build.yml}. The workflow runs on pushes to \texttt{main}, \texttt{develop}, \texttt{qa}, and \texttt{staging}, as well as pull requests. It starts with secret scanning, then backend tests, frontend build and tests, Docker image build and push, image vulnerability scanning, Kustomize tag updates, and a smoke test for the development environment. This is a serious quality signal for a university project because it connects code changes to automated verification and deployment artifacts.

        \section{Chapter Conclusion}
        The verified project context is an HR performance management system implemented as a full-stack engineering project. Missing academic metadata is separated from technical evidence. The next chapter analyzes the business problem, expected solution, risks, and planning.
    """))

    w("chapters/chapter02-analysis-planning.tex", chapter("Project Analysis, Existing Solutions, and Planning", r"""
        \section{Problem Statement}
        Manual performance management usually fails in three places. First, the objective agreement is often weakly documented, so employees and managers later debate what was expected. Second, progress evidence is fragmented, making mid-year and end-year reviews heavily dependent on memory. Third, HR validation can become a late administrative signature rather than a real process check. PerTrack targets these weaknesses by storing objectives, KPI targets, check-ins, tasks, review drafts, manager decisions, HR validation status, and audit logs in one system.

        \section{Project Objectives}
        The repository supports the following objectives:
        \begin{itemize}
        \item Provide authenticated access for four roles with route-level and UI-level restrictions.
        \item Model annual cycles with three phases: objective planning, mid-year review, and final evaluation.
        \item Support objective creation, approval, revision, acknowledgment, KPI management, comments, attachments, and progress updates.
        \item Track tasks, meetings, feedback, notifications, audit events, career actions, improvement plans, and HR decisions.
        \item Calculate objective-based performance scores with manager override and HR validation.
        \item Offer AI-assisted drafts and predictive analysis while keeping fallback paths.
        \item Package and deploy the system through Docker, Kubernetes, Kustomize, Argo CD, and GitHub Actions.
        \end{itemize}

        \section{Scope}
        The implemented scope is an internal web platform rather than a public SaaS product. The \texttt{User} model enforces email addresses ending in \texttt{@biat.com}, which suggests an organization-specific deployment. Multi-tenancy appears only as a default \texttt{tenantId} field and is not implemented as a full isolation model. Calendar integration is present, but the repository does not prove a production OAuth configuration. AI generation depends on external API keys and uses fallback behavior when unavailable.

        \section{Comparable Solutions}
        Mature HR platforms generally include goal tracking, performance review forms, continuous feedback, reporting, and workflow approvals. PerTrack is narrower than a commercial HRIS, but it is deeper than a simple goal tracker because it includes phase governance, manager and HR validation, score calculation, audit logs, task evidence, and AI support. The comparison below is conceptual and based on categories, not a claim about exact commercial product internals.

        \begin{table}[H]\centering\small
        \caption{Comparative analysis by feature category.}
        \label{tab:comparative-analysis}
        \begin{tabularx}{\textwidth}{p{0.25\textwidth}YYY}
        \toprule
        Category & Generic spreadsheet process & Generic HR platform & PerTrack implementation\\
        \midrule
        Objective governance & Manual and hard to audit & Usually workflow-based & Explicit objective statuses, manager approval, revision, activity logs\\
        KPI tracking & Often inconsistent & Often configurable & Embedded KPIs with metric type, current/target values, and status\\
        Role permissions & Informal sharing & Product-specific RBAC & Backend role middleware plus frontend route restrictions\\
        HR validation & Email or manual sign-off & Common in enterprise tools & Final evaluation status \texttt{pending\_hr}, validation, return reason, workflow history\\
        AI assistance & Not available & Increasingly available & LLM drafts plus Flask prediction service; synthetic data limitation stated\\
        Deployment & Local documents & Vendor-hosted & Docker, Kubernetes, GitHub Actions, Argo CD manifests\\
        \bottomrule
        \end{tabularx}
        \end{table}

        \section{Risk Analysis}
        \begin{longtable}{p{0.23\textwidth}p{0.23\textwidth}p{0.18\textwidth}p{0.26\textwidth}}
        \caption{Project risk matrix.}\label{tab:risk-matrix}\\
        \toprule
        Risk & Cause & Impact & Mitigation in the project\\
        \midrule
        \endfirsthead
        \toprule
        Risk & Cause & Impact & Mitigation in the project\\
        \midrule
        \endhead
        Incorrect score calculation & Mixed individual, team, and legacy objectives & Unfair final evaluation & Dedicated score service and Jest tests for weighting and normalization\\
        Objective visibility leak & Managers and employees share sensitive drafts & Confidentiality issue & Visibility helper hides private draft individual objectives from non-owners\\
        Phase inconsistency & Cycle moves before objectives are ready & Broken annual workflow & Phase checks in cycle routes before phase advancement\\
        AI hallucination & LLM generates unsupported content & Misleading HR text & Prompts instruct use of supplied data only, JSON validation, fallback output\\
        Synthetic model bias & Prediction service trained on generated data & Limited real-world validity & Report states limitation; AI service validates inputs and exposes confidence/probability\\
        Secret exposure & CI/CD and AI keys require secrets & Security incident & Gitleaks secret scan, environment-variable validation, no secrets in report\\
        Deployment drift & Kubernetes manifests diverge from image versions & Broken dev environment & GitOps tag update and Argo CD automated sync\\
        \bottomrule
        \end{longtable}

        \input{diagrams/gantt-chart}

        \section{Planning by Sprints}
        The repository does not contain an official sprint calendar. For report clarity, implementation is organized into five engineering sprints reconstructed from module dependencies:
        \begin{enumerate}
        \item Foundation, organization, authentication, users, teams, cycles, and access control.
        \item Objectives, KPIs, task management, check-ins, and phase-aware progress.
        \item Evaluation workflows, final evaluation, HR validation, follow-up actions, and PDF/report exports.
        \item AI assistance, prediction service, analytics, and auditability.
        \item Testing, CI/CD, Docker, Kubernetes, GitOps, and deployment verification.
        \end{enumerate}

        \section{Chapter Conclusion}
        The project scope is coherent: it is an internal performance-management platform with strong workflow and governance needs. The main risks are not exotic technology problems; they are business-rule correctness, privacy, phase consistency, and honest AI use.
    """))

    w("chapters/chapter03-requirements-architecture.tex", chapter("Requirements and System Architecture", r"""
        \section{Functional Requirements}
        \begin{longtable}{p{0.12\textwidth}p{0.35\textwidth}p{0.43\textwidth}}
        \caption{Functional requirements verified from source code.}\label{tab:functional-requirements}\\
        \toprule
        ID & Requirement & Evidence\\
        \midrule
        \endfirsthead
        \toprule
        ID & Requirement & Evidence\\
        \midrule
        \endhead
        FR-01 & Authenticate users with access and refresh tokens & \texttt{backend/routes/auth.js}, \texttt{frontend/src/components/AuthContext.jsx}\\
        FR-02 & Restrict actions by role & \texttt{backend/middleware/role.js}, \texttt{frontend/src/routes/routeConfig.jsx}\\
        FR-03 & Manage users and profile avatars & \texttt{backend/routes/users.js}, \texttt{User.js}\\
        FR-04 & Manage teams and subteams & \texttt{backend/routes/teams.js}, \texttt{Team.js}\\
        FR-05 & Create and advance performance cycles & \texttt{backend/routes/cycles.js}, \texttt{Cycle.js}\\
        FR-06 & Create, submit, approve, revise, evaluate, and lock objectives & \texttt{backend/routes/objectives.js}, \texttt{objectiveController.js}\\
        FR-07 & Track KPIs embedded inside objectives & \texttt{Objective.js}, objective KPI routes\\
        FR-08 & Submit and review check-ins with attachments & \texttt{CheckIn.js}, \texttt{checkInController.js}\\
        FR-09 & Manage kanban-like tasks and time tracking & \texttt{Task.js}, \texttt{frontend/src/pages/TasksPage.jsx}\\
        FR-10 & Generate final evaluations and HR validations & \texttt{FinalEvaluation.js}, \texttt{finalEvaluationController.js}\\
        FR-11 & Record HR decisions, improvement plans, and bonus/penalty decisions & \texttt{HRDecision.js}, \texttt{ImprovementPlan.js}, \texttt{BonusPenalty.js}\\
        FR-12 & Provide AI drafts and predictions & \texttt{backend/routes/ai.js}, \texttt{ai-service/app.py}\\
        FR-13 & Provide analytics, reports, audit logs, and notifications & \texttt{stats.js}, \texttt{reports.js}, \texttt{auditLog.js}, \texttt{notifications.js}\\
        \bottomrule
        \end{longtable}

        \section{Non-Functional Requirements}
        \begin{table}[H]\centering\small
        \caption{Non-functional requirements and implementation evidence.}
        \label{tab:nonfunctional-requirements}
        \begin{tabularx}{\textwidth}{p{0.25\textwidth}YY}
        \toprule
        Requirement & Implementation & Limitation\\
        \midrule
        Security & Helmet, CORS allowlist, rate limiting, XSS cleaning, Mongo sanitization, JWT, bcrypt, RBAC & No formal penetration test or CSRF protection evidence\\
        Traceability & Audit log model, audit helpers, objective activity logs, final evaluation workflow history & Audit coverage may not include every route\\
        Maintainability & Route-controller-model organization, services for scoring and AI, shared frontend utilities & Some legacy duplicated evaluation modules remain\\
        Usability & Role-specific routes, dashboard shell, empty/loading components, charts, modals & No accessibility audit found\\
        Portability & Dockerfiles, Docker Compose, Kubernetes base and overlays & AI service is not included in Compose/Kubernetes base manifests\\
        Testability & Jest, Supertest, React Testing Library, validation and scoring tests & No coverage percentage stored in repository\\
        \bottomrule
        \end{tabularx}
        \end{table}

        \section{Architecture}
        The frontend and backend communicate through REST-style JSON endpoints. React Router defines the protected pages, while Axios clients attach access tokens and refresh them when a request returns \texttt{401}. The backend authenticates JWT bearer tokens, loads the current user profile, checks role permissions, validates request payloads with Joi in selected routes, and stores data through Mongoose.

        \input{diagrams/logical-architecture}
        \input{diagrams/component-diagram}
        \input{diagrams/database-model}

        \section{Technology Choices}
        React is used for component-driven UI construction \cite{reactDocs}. Vite provides the development and production build workflow \cite{viteDocs}. Express provides routing and middleware composition \cite{expressDocs}. Mongoose defines MongoDB schemas, validation, hooks, indexes, and references \cite{mongooseSchemas}. Flask is used for the Python prediction API through route decorators and JSON request handling \cite{flaskDocs}. XGBoost and scikit-learn provide the implemented model APIs \cite{xgboostDocs,sklearnRF}.

        \begin{table}[H]\centering\small
        \caption{Technology-choice table based on package manifests.}
        \label{tab:technology-choice}
        \begin{tabularx}{\textwidth}{p{0.22\textwidth}p{0.25\textwidth}Y}
        \toprule
        Layer & Verified technology & Role in project\\
        \midrule
        Frontend & React 18, Vite, React Router, Axios & SPA, routing, API communication, role-aware pages\\
        UI analytics & Chart.js, Recharts, react-chartjs-2 & Dashboards and performance visualizations\\
        Backend & Node.js, Express 4, Mongoose 7 & REST API, middleware, persistence, domain rules\\
        Security & JWT, bcryptjs, Helmet, CORS, rate limit, xss-clean, mongo-sanitize & Authentication and request hardening\\
        AI generation & OpenAI SDK, Google Generative AI package & LLM provider abstraction for review drafts and suggestions\\
        AI prediction & Flask, pandas, scikit-learn, XGBoost, joblib & Prediction API and saved model artifacts\\
        DevOps & Docker, Nginx, Kubernetes, Kustomize, Argo CD, GitHub Actions & Build, deploy, GitOps and CI/CD\\
        \bottomrule
        \end{tabularx}
        \end{table}

        \section{API Architecture}
        The backend mounts 26 route modules under \texttt{/api}. The main API groups are authentication, users, team members, teams, cycles, objectives, HR decisions, notifications, feed, statistics, audit logs, meetings, AI, feedback, tasks, calendar, career, performance, reports, evaluations, PDF export, check-ins, final evaluations, improvement plans, and bonus/penalty.

        \section{Chapter Conclusion}
        The architecture is a practical MERN-style application with a separate Python AI service. The strongest architectural feature is the separation of domain rules into services and utilities; the main architectural limitation is that the AI prediction microservice is not fully integrated into the Docker/Kubernetes deployment files.
    """))

    w("chapters/chapter04-organization-access.tex", chapter("Sprint 1: Organization, Access Control, and Cycle Foundation", r"""
        \section{Sprint Objective}
        The first implementation sprint establishes the foundation required by all later performance workflows: authentication, users, roles, teams, subteams, current-user context, protected frontend routes, and performance cycles.

        \section{Authentication}
        Login is implemented in \texttt{backend/routes/auth.js}. The backend verifies email and password, compares the submitted password with the bcrypt hash stored in MongoDB, and returns an access token plus a refresh token. The frontend stores both tokens in \texttt{localStorage}. \texttt{AuthContext.jsx} keeps the current user in React context, persists a lightweight user object, and refreshes the access token through \texttt{/api/auth/refresh} when necessary.

        JWT is a compact claims format standardized in RFC 7519 \cite{rfc7519}. In this application, the token is used for stateless API authentication, while the refresh token is also stored against the user record. The implementation validates that a token maps to an active, non-deleted user before setting \texttt{req.user}. This extra lookup prevents deleted or disabled users from continuing to access the API only because they still hold an unexpired token.

        \section{Role-Based Access Control}
        The role list is defined in \texttt{backend/models/User.js}: \texttt{ADMIN}, \texttt{HR}, \texttt{TEAM\_LEADER}, and \texttt{COLLABORATOR}. The \texttt{role.js} middleware rejects requests where the current role is not in the allowed set, while automatically allowing the administrator to pass role checks. Frontend route metadata repeats role restrictions so the navigation shell does not advertise pages the current user should not access.

        \input{diagrams/role-permission}

        \section{Team and Subteam Management}
        The \texttt{Team} schema stores a name, description, leader, members, parent team, and creator. This supports both main teams and subteams through the \texttt{parentTeam} reference. Route code checks whether a team leader manages a root team or one of its descendants. That recursive managed-team logic appears in \texttt{backend/utils/accessControl.js} and is reused by employee access decisions.

        Team creation validates role coherence: leaders must be \texttt{TEAM\_LEADER}, \texttt{ADMIN}, or \texttt{HR}; members must be collaborators; and a manager cannot be assigned to multiple root teams in the same way. This reduces administrative ambiguity and avoids a common problem in HR tools: a person appears under two managers with conflicting evaluation authority.

        \section{Cycle Management}
        Performance cycles are stored in \texttt{Cycle.js}. Each cycle has a unique year, status, and six dates for phase starts and ends. The phase structure is explicit: \texttt{phase1}, \texttt{phase2}, \texttt{phase3}, and \texttt{closed}. The schema validates sequential phase dates when they are modified. The routes add business checks before phase advancement, including checks for unapproved objectives and incomplete readiness conditions.

        \input{diagrams/cycle-state}

        \section{Security Controls Introduced in This Sprint}
        The Express app applies Helmet, CORS, compression, JSON parsing, XSS cleaning, MongoDB sanitization, cache-control headers, rate limiting, and protected static-upload rules. Passwords are hashed with bcrypt using 12 salt rounds. The implementation also hides check-in upload files behind a blocked static route and serves other uploads with caching.

        These controls reduce common web risks but do not make the system fully secure by themselves. OWASP API guidance emphasizes that authorization mistakes at object level and property level remain common API risks \cite{owaspApi}. PerTrack addresses some of this through helper functions such as \texttt{canAccessEmployee}, \texttt{canAccessTeam}, and \texttt{canAccessObjective}, but a complete security assessment would still require endpoint-by-endpoint review and dynamic testing.

        \section{Sprint Result}
        At the end of this sprint, the application can identify users, enforce broad role permissions, represent teams and subteams, create annual cycles, and expose protected frontend pages. These foundations make later workflows possible because every objective, task, check-in, and evaluation needs a user, role, team scope, and active cycle.
    """))

    w("chapters/chapter05-objectives-kpis-tasks.tex", chapter("Sprint 2: Objectives, KPIs, Tasks, and Check-Ins", r"""
        \section{Sprint Objective}
        The second sprint implements the work-management core of the system. Objectives define expected performance, KPIs make success measurable, tasks create day-to-day execution evidence, and check-ins provide periodic progress records.

        \section{Objective Model}
        \texttt{Objective.js} is one of the richest schemas in the repository. It stores title, due date, description, success indicator, owner, cycle, category, team, assigned users, weight, priority, achievement percent, self-assessment fields, final self-assessment fields, manager adjustment, weighted score, workflow status, source, assignment metadata, rejection and revision reasons, evaluation fields, labels, visibility, parent objective, embedded KPIs, progress updates, comments, attachments, change requests, activity logs, and manager notes.

        \section{Objective Lifecycle}
        The implemented status list includes \texttt{draft}, \texttt{pending}, \texttt{submitted}, \texttt{pending\_approval}, \texttt{revision\_requested}, \texttt{rejected}, \texttt{assigned}, \texttt{acknowledged}, \texttt{approved}, \texttt{validated}, \texttt{locked}, \texttt{cancelled}, \texttt{evaluated}, and \texttt{archived}. The list preserves legacy states while supporting newer states such as manager-assigned objectives and correction requests.

        \input{diagrams/objective-sequence}
        \input{diagrams/global-workflow}

        \section{Weight Rules}
        Objective weights are central business rules. The code validates individual objective weights between 1 and 100, calculates totals, excludes cancelled and archived objectives from allocation, deduplicates team objective copies, and computes employee allocation in separate buckets for individual, team, and subteam objectives.

        For one objective, the weighted contribution is:
        \[
        P_o = \frac{w_o \times a_o}{100}
        \]
        where \(w_o\) is the objective weight and \(a_o\) is the achievement percentage used for scoring.

        For final evaluation scoring, eligible objective statuses are \texttt{approved}, \texttt{validated}, \texttt{evaluated}, and \texttt{locked}. If the total eligible weight is exactly 100, the score is the sum of weighted points. If the eligible total is not 100, the score is normalized:
        \[
        S =
        \begin{cases}
        \sum P_o, & \text{if } \sum w_o = 100\\
        \frac{\sum P_o}{\sum w_o} \times 100, & \text{if } 0 < \sum w_o \neq 100\\
        0, & \text{if } \sum w_o = 0
        \end{cases}
        \]
        This normalization exists to avoid unfairly penalizing legacy or incomplete cycles where the administrative total does not reach 100 percent.

        \begin{lstlisting}[caption={Core weighted-points rule from the scoring service.}]
        const weightedPoints = Number(((weight * achievement) / 100).toFixed(2));
        \end{lstlisting}

        \section{Team Objective Weighting}
        The tests make a subtle rule explicit: a team objective weight is not divided among members. If a 40 percent team objective is assigned to four members, it consumes 40 percent of each assigned member's team-objective budget. This is important because it preserves the importance of shared work instead of making it vanish as team size grows.

        \input{diagrams/kpi-flow}

        \section{KPI Management}
        KPIs are embedded inside objectives. Each KPI has title, metric type, initial value, target value, current value, unit, and status. Supported metric types are percent, number, currency, boolean, and milestone. The frontend detail panel lets users add KPIs, update current values, search KPIs, and visualize progress. The backend exposes routes to add, update, and delete KPIs under \texttt{/api/objectives/:id/kpis}.

        \section{Tasks}
        The \texttt{Task} model supports title, description, assignee, assignedBy, status, priority, workflow stage, progress, labels, due date, completion date, recurrence, linked goal, phase, KPI id, linked meeting, team, notes, and time tracking sessions. The frontend \texttt{TasksPage.jsx} implements kanban-like behavior using statuses such as \texttt{todo}, \texttt{in\_progress}, \texttt{done}, and \texttt{cancelled}. Time tracking is stored both in a nested \texttt{timeTracking} structure and legacy-style \texttt{timeSessions}, showing compatibility with evolving frontend features.

        \section{Check-Ins}
        Check-ins connect an employee, objective, and cycle. They include progress percentage, notes, priority, attachments, status, history, manager feedback, and review metadata. A manager or authorized HR/admin actor can approve a check-in or request revision. When a reviewed check-in includes progress, the controller may update the related objective's achievement percentage. This creates a data path from periodic evidence to objective progress.

        \screenplaceholder{Objective management screen}{Expected view: objectives table, status badge, weight, progress, KPI count, and action menu.}
        \screenplaceholder{Task kanban screen}{Expected view: task columns, progress slider, priority, due date, and timer widget.}

        \section{Sprint Result}
        This sprint turns performance planning into concrete work data. Objectives hold the contract, KPIs hold the measurement structure, tasks hold execution evidence, and check-ins hold periodic progress. The largest engineering challenge is consistency: the same objective must behave correctly across role visibility, status changes, team distribution, weight budgets, and final scoring.
    """))

    w("chapters/chapter06-evaluation-hr.tex", chapter("Sprint 3: Evaluation, HR Review, and Follow-Up Decisions", r"""
        \section{Sprint Objective}
        The third sprint implements the evaluation and HR governance workflows. It transforms approved objectives and progress evidence into manager reviews, HR-validated final evaluations, follow-up plans, career recommendations, and compensation or discipline-related decisions.

        \section{Two Evaluation Layers}
        The repository contains both \texttt{Evaluation} and \texttt{FinalEvaluation}. The first model represents a general manager evaluation workflow with statuses from \texttt{draft} to \texttt{completed}, suggested score, final score, score history, approvals, and employee acknowledgment. The second model is richer and appears to be the main end-year workflow: it stores objective breakdown, evidence summaries, manager score, final score, rating label, HR status, workflow history, performance status, recommendation, HR decision, and employee feedback.

        This distinction matters. A report that merges both models into one generic evaluation feature would hide the real implementation. The application has a general evaluation module and a final annual evaluation module, with overlapping but different responsibilities.

        \input{diagrams/evaluation-sequence}

        \section{Automatic Score and Manager Adjustment}
        \texttt{scoreCalculationService.js} calculates automatic objective-based performance. It chooses the achievement value in priority order: manager-adjusted percent, final self percent, then current achievement percent. This means manager confirmation can override employee input, while still preserving the employee achievement in the objective breakdown.

        Rating labels are mapped from final score:
        \begin{table}[H]\centering
        \caption{Final score rating bands implemented in \texttt{scoreCalculationService.js}.}
        \label{tab:rating-bands}
        \begin{tabular}{ll}
        \toprule
        Score range & Rating label\\
        \midrule
        90--100 & \texttt{exceptional}\\
        75--89 & \texttt{strong}\\
        50--74 & \texttt{meets\_expectations}\\
        30--49 & \texttt{needs\_improvement}\\
        0--29 & \texttt{unsatisfactory}\\
        \bottomrule
        \end{tabular}
        \end{table}

        \section{HR Validation}
        HR validation is more than changing a status. \texttt{workflowRules.js} builds warnings and blocking issues before HR review. It checks whether final score, rating, manager comments, strengths, weaknesses, objective breakdown, AI review confirmation, improvement plan, career recommendation, and bonus documentation are coherent. Some warnings are advisory, while blocking issues prevent validation.

        \input{diagrams/hr-review-sequence}

        \section{Improvement Plans}
        The \texttt{ImprovementPlan} model links a plan to a final evaluation, employee, and cycle. It stores the improvement objective, deadline, expected outcome, notes, progress status, creator, and updater. The controller restricts creation and destructive actions primarily to HR and admin actors, while allowing scoped visibility for the employee and team leader. This is a realistic design because improvement plans are sensitive and should not behave like ordinary tasks.

        \section{HR Decisions and Bonus/Penalty Records}
        \texttt{HRDecision} stores the employee, cycle, final evaluation, individual score, team score, final score, action, action label, decision maker, date, and notes. \texttt{BonusPenalty} stores a bonus or penalty record linked to an employee, final evaluation, optional HR decision, and optional objective. It also stores approval status and review notes. The workflow rules validate that bonus or penalty value must be positive and that a reason is required.

        \section{Career Development}
        Career modules include competencies, career paths, development actions, and career recommendations. Recommendations can be generated from a final evaluation and saved with suggested path, skills to develop, source, and basis. The design links development decisions to performance evidence rather than isolating career management as a separate module.

        \section{PDF and Report Exports}
        The backend contains PDF routes using PDFKit for team and user reports, and final evaluation export routes. The frontend also includes PDF/export-related components and libraries such as \texttt{jspdf} and \texttt{html2canvas}. The repository verifies PDF capability, but it does not prove that every final report view was manually exported in a production environment.

        \screenplaceholder{Final evaluation manager screen}{Expected view: objective breakdown, automatic score, manager score, strengths, weaknesses, recommendation, and submit-to-HR action.}
        \screenplaceholder{HR validation screen}{Expected view: pending HR queue, blocking warnings, validation action, return reason, and audit trail.}

        \section{Sprint Result}
        The evaluation sprint gives the project its business value. It connects objective evidence with manager judgment and HR governance. The implementation is strongest where it validates process quality before HR validation. Its main limitation is complexity: two evaluation models coexist, and future maintenance should keep their responsibilities clearly separated or consolidate them deliberately.
    """))

    w("chapters/chapter07-ai-analytics.tex", chapter("Sprint 4: AI Assistance, Prediction, Analytics, and Auditability", r"""
        \section{Sprint Objective}
        The fourth sprint adds decision-support features: AI-assisted writing, performance prediction, dashboard analytics, reports, and audit logs. These modules are useful only if the report is careful about what is implemented and what remains a limitation.

        \section{Generative AI Service}
        The Node service \texttt{backend/services/aiService.js} is provider-agnostic. It supports Gemini through \texttt{@google/generative-ai}, and OpenAI-compatible chat completions for xAI/Grok and OpenAI through the \texttt{openai} package. Provider, model, timeout, and maximum input size are controlled by environment variables.

        The service builds compact context strings, truncates overly large context, asks for JSON-only outputs, parses JSON, performs light cleanup if necessary, validates the returned fields, and falls back to empty structured output with a warning when generation fails. Review modes include mid-year summary, final self-assessment, manager review, and development plan. This is a practical pattern because AI outputs are treated as drafts, not as authoritative HR decisions.

        \section{AI Controller Capabilities}
        The backend exposes endpoints for goal suggestions, KPI suggestions, performance summaries, risk detection, notification prioritization, assistant responses, check-in drafts, objective-quality analysis, objective refinement, mid-year review, final self-review, manager review, development plan, evaluation draft generation, prediction user lists, employee performance predictions, and prediction requests. Permission checks are stronger for manager-review and evaluation-draft paths than for general assistance paths.

        \input{diagrams/ai-inference-sequence}

        \section{Python Prediction Service}
        The \texttt{ai-service} folder contains a Flask API, a synthetic CSV dataset with 10,000 rows, training code, saved model artifacts, and a shared text generator. The prediction API exposes \texttt{GET /health}, \texttt{POST /predict}, and \texttt{POST /predict/batch}. The API requires eight numeric features:
        \begin{itemize}
        \item KPI score
        \item Goal completion percentage
        \item Check-in count
        \item Average check-in progress
        \item Feedback count
        \item Positive feedback ratio
        \item Task completion percentage
        \item Tasks-on-time percentage
        \end{itemize}

        The API validates bounds for every feature, loads \texttt{rating\_xgb.joblib}, \texttt{promotion\_xgb.joblib}, and \texttt{rating\_label\_encoder.joblib}, then returns rating, rating confidence, promotion readiness, promotion probability, deterministic overall score, strengths, weaknesses, summary, and suggestions.

        \section{Prediction Formula}
        The service computes an overall score independently of the model:
        \[
        S_{\mathrm{overall}} =
        0.30KPI +
        0.25Goal +
        0.15CheckInProgress +
        0.20TaskCompletion +
        0.10(PositiveFeedbackRatio \times 100)
        \]
        The training script deliberately excludes this \texttt{overall\_score} column from the model inputs because it is deterministic from the raw features. This avoids allowing the classifier to learn a trivial threshold from a precomputed score.

        \section{Dataset and Model Evidence}
        The included dataset has 10,000 rows, 0 missing values, and 0 duplicate rows. Rating distribution is: 2,238 exceptional, 2,722 exceeds expectations, 2,440 meets expectations, and 2,600 needs improvement. Promotion readiness is intentionally probabilistic by rating: about 79.62 percent for exceptional, 51.03 percent for exceeds expectations, 21.02 percent for meets expectations, and 2.46 percent for needs improvement.

        \begin{table}[H]\centering\small
        \caption{Model evaluation on the saved artifacts using the repository training split.}
        \label{tab:model-results}
        \begin{tabularx}{\textwidth}{p{0.26\textwidth}p{0.24\textwidth}p{0.2\textwidth}Y}
        \toprule
        Task & Model & Metric & Result\\
        \midrule
        Rating classification & Random Forest & Accuracy & 0.9715\\
        Rating classification & XGBoost & Accuracy & 0.9780\\
        Promotion readiness & Random Forest & Accuracy / ROC-AUC & 0.7505 / 0.8346\\
        Promotion readiness & XGBoost & Accuracy / ROC-AUC & 0.7480 / 0.8218\\
        \bottomrule
        \end{tabularx}
        \end{table}

        The selected API models are XGBoost for both tasks. This is defensible for the rating task because XGBoost has the strongest measured accuracy in the repository evaluation. For promotion readiness, Random Forest has slightly higher ROC-AUC in the local evaluation, while the API still uses XGBoost. This should be documented as an implementation choice rather than overstated as universally superior.

        \section{Analytics}
        Analytics endpoints exist under \texttt{/api/stats}, \texttt{/api/performance}, and \texttt{/api/reports}. The frontend includes dashboards, performance pages, analytics pages, prediction pages, and chart libraries. Dashboard utilities compute status summaries, completion rates, check-in summaries, task summaries, timeline buckets, and performance trend data.

        \section{Auditability}
        Auditability appears at two levels. First, \texttt{AuditLog} stores user, action, entity type, entity id, entity name, role, description, changes, metadata, IP address, and timestamp. Second, objectives and final evaluations keep embedded activity or workflow history. This combination is useful because system-wide audit logs answer compliance questions, while embedded history gives contextual traceability inside a business object.

        \section{AI Limitations and Ethics}
        The AI prediction dataset is synthetic. Therefore, prediction metrics cannot be presented as real organizational performance validity. A real deployment would need historical data governance, consent and privacy review, bias analysis, explainability review, retraining controls, and monitoring for drift. The generative AI system can draft text, but the project already recognizes the need for human review through warnings such as \texttt{AI-assisted draft has not been confirmed as reviewed by the manager}. That is the correct posture for HR use.

        \screenplaceholder{Performance prediction screen}{Expected view: employee selector, prediction status, rating confidence, promotion probability, and generated suggestions.}
        \screenplaceholder{Analytics dashboard}{Expected view: charts for objective status, score distribution, team summaries, and progress trends.}

        \section{Sprint Result}
        The AI and analytics sprint adds value by helping users write better reviews and interpret performance evidence. Its most important engineering quality is that the code contains validation and fallback paths. Its most important limitation is also clear: predictive AI is trained on synthetic data and should not be treated as a production HR decision engine without real validation.
    """))

    w("chapters/chapter08-devops.tex", chapter("Sprint 5: Testing, Continuous Integration, and Deployment", r"""
        \section{Sprint Objective}
        The fifth sprint verifies the application and prepares it for repeatable deployment. The repository includes local tests, production frontend build scripts, Dockerfiles, Docker Compose, Kubernetes manifests, Kustomize overlays, an Argo CD application, and a GitHub Actions pipeline.

        \section{Testing Strategy}
        Backend tests use Jest and Supertest. Frontend tests use Jest, Babel, jsdom, and React Testing Library. Local verification performed for this report produced:
        \begin{itemize}
        \item Backend: 9 test suites passed, 45 tests passed.
        \item Frontend: 5 test suites passed, 14 tests passed.
        \item Frontend production build: Vite build succeeded.
        \end{itemize}

        \begin{table}[H]\centering\small
        \caption{Local verification results from July 21, 2026.}
        \label{tab:local-verification}
        \begin{tabularx}{\textwidth}{p{0.28\textwidth}p{0.28\textwidth}Y}
        \toprule
        Command & Result & Evidence used in report\\
        \midrule
        \texttt{backend: npm test -- --runInBand} & 9 suites, 45 tests passed & Scoring, workflow, health, visibility, validation, task privacy\\
        \texttt{frontend: npm test -- --runInBand} & 5 suites, 14 tests passed & Login, app routes, sidebar, objective modal, shared motion\\
        \texttt{frontend: npm run build} & Build succeeded & Vite transformed 881 modules and generated \texttt{dist}\\
        \bottomrule
        \end{tabularx}
        \end{table}

        \section{Backend Test Coverage by Behavior}
        The backend tests are especially valuable because they protect business rules. The scoring test confirms weighted objective contributions, manager-adjusted achievement, no division of team-objective weight by member count, exclusion of draft and non-final statuses, normalization of incomplete weight totals, and rating-band mapping. Workflow tests check HR review warnings, blocking issues, and bonus/penalty input. Objective-rule tests check allocation buckets and distributed team objectives.

        \section{Frontend Test Coverage by Behavior}
        Frontend tests cover basic application rendering, login behavior, objective modal interaction, sidebar behavior, and shared motion. This confirms that at least the core shell and selected components are testable. The repository does not include end-to-end tests with a real browser, seeded database, and authenticated workflows.

        \section{Dockerization}
        The backend Dockerfile uses \texttt{node:22-alpine}, installs production dependencies with \texttt{npm ci --omit=dev}, exposes port 5000, and starts \texttt{server.js}. The frontend Dockerfile builds the Vite app in a Node stage and serves \texttt{dist} through Nginx. The Nginx configuration routes normal SPA paths to \texttt{index.html} and proxies \texttt{/api} to the backend service.

        Docker documentation defines Dockerfiles as text documents containing image build instructions \cite{dockerDocs}. The implementation follows the common pattern of separating frontend build and static serving.

        \section{Kubernetes and GitOps}
        Kubernetes manifests define backend and frontend Deployments and ClusterIP Services. The frontend base uses two replicas; the backend base uses one replica and loads environment variables from \texttt{backend-secret}. Kustomize overlays exist for dev, QA, staging, and production. Kustomize bases and overlays match the official Kubernetes model for reusable configuration \cite{kustomizeDocs}.

        The Argo CD application points to the GitHub repository path \texttt{k8s/base}, target revision \texttt{main}, namespace \texttt{pfe}, and enables automated sync with prune and self-heal. Argo CD's automated sync model compares desired Git state with live cluster state and can apply changes automatically \cite{argoDocs}.

        \input{diagrams/deployment-architecture}
        \input{diagrams/ci-cd-pipeline}

        \section{CI/CD Pipeline}
        The GitHub Actions workflow runs on push and pull request. It performs:
        \begin{enumerate}
        \item Secret scanning with Gitleaks.
        \item Backend dependency installation and tests.
        \item Frontend dependency installation, build, and tests.
        \item Docker Buildx setup.
        \item Docker Hub login on push.
        \item Backend and frontend image build.
        \item Image push on push events.
        \item Development Kustomize image tag update for the \texttt{develop} branch.
        \item Trivy vulnerability scans for backend and frontend images.
        \item Optional smoke health check against \texttt{DEV\_APP\_URL}.
        \end{enumerate}
        GitHub Actions workflow syntax is the official mechanism used for these repository automations \cite{githubActionsDocs}.

        \section{Deployment Limitations}
        The deployment configuration covers frontend and backend containers, but the Python AI prediction service is not represented in the main Docker Compose or Kubernetes base manifests. The backend depends on secrets such as Mongo URI and JWT secrets, but the report does not expose them. There is no monitoring stack such as Prometheus or Grafana in the repository. No backup or disaster recovery manifest is present beyond demo backup data files.

        \section{Chapter Conclusion}
        Testing and DevOps evidence is strong for a graduation project. The tests validate important business rules, and the pipeline connects security scanning, build verification, image creation, vulnerability scanning, and GitOps deployment. The main operational gap is incomplete deployment coverage for the AI microservice and missing observability assets.
    """))

    w("chapters/general-conclusion.tex", chapter("General Conclusion and Perspectives", r"""
        PerTrack addresses a concrete HR engineering problem: performance management needs structured objectives, measurable progress, role-based governance, auditable evaluation, and HR validation. The implemented application goes beyond simple record keeping. It models annual cycles, team hierarchy, objective states, KPI tracking, tasks, check-ins, manager evaluation, final HR review, follow-up decisions, analytics, audit logs, and AI support.

        The main technical contribution is the combination of workflow logic and score calculation. Objective weights are treated as business rules, not as display metadata. Manager-adjusted achievement can override employee self-reported progress, but the objective breakdown preserves the source values. HR review contains process checks before validation. This design is suitable for sensitive evaluation workflows because it makes decisions traceable.

        The project also demonstrates modern implementation practices: React and Vite for the frontend, Express and Mongoose for the backend, Flask and XGBoost for the AI prediction service, JWT authentication, security middleware, structured tests, Docker images, Kubernetes manifests, Kustomize overlays, Argo CD GitOps configuration, and GitHub Actions CI/CD.

        The project remains honest about its limitations. Academic and organization metadata is missing from the repository. The AI dataset is synthetic and cannot prove real-world predictive validity. The AI microservice is not fully represented in the container orchestration manifests. Security controls exist, but no penetration test or accessibility audit is present. Some evaluation functionality exists in overlapping modules and should be simplified during future maintenance.

        Realistic future work includes single sign-on, stronger object-level authorization audits, accessibility testing, end-to-end tests with seeded data, complete AI service deployment, real organizational training data under strict privacy governance, bias monitoring, explainable prediction outputs, stronger observability, backup policies, richer HRIS integration, and optional mobile support.
    """))

    # Appendices
    w("appendices/api-summary.tex", r"""
        \chapter{API Summary}
        \begin{longtable}{p{0.2\textwidth}p{0.23\textwidth}p{0.47\textwidth}}
        \caption{Grouped API inventory.}\label{tab:api-summary}\\
        \toprule
        Base route & Main methods & Purpose\\
        \midrule
        \endfirsthead
        \toprule
        Base route & Main methods & Purpose\\
        \midrule
        \endhead
        \texttt{/api/auth} & POST, GET & Login, token refresh, logout, current-user lookup\\
        \texttt{/api/users} & GET, PUT, DELETE & User lists, managers, collaborators, admin user access, profile/avatar update\\
        \texttt{/api/teams} & GET, POST, PUT, DELETE & Team and subteam CRUD, team summaries, managed team access\\
        \texttt{/api/team-members} & GET & Team member lookup and fallback active users\\
        \texttt{/api/cycles} & GET, POST, PUT, PATCH, DELETE & Cycle CRUD, phase advancement, phase check, rollback\\
        \texttt{/api/objectives} & GET, POST, PUT, PATCH, DELETE & Objective CRUD, submit, validate, acknowledge, complete, evaluate, lock, KPIs, comments, progress, change requests\\
        \texttt{/api/checkins} & GET, POST, PUT & Check-in submission, attachments, team review, objective task lookup\\
        \texttt{/api/tasks} & GET, POST, PUT, DELETE & Task creation, assignment, stats, team tasks, time entries\\
        \texttt{/api/evaluations} & GET, POST, PUT & General evaluation creation, scoring, submission, HR approval/rejection, acknowledgment\\
        \texttt{/api/final-evaluations} & GET, POST, PUT & Final evaluation generation, team views, HR queues, HR validation, employee feedback, export\\
        \texttt{/api/hr-decisions} & GET, POST, PUT, DELETE & HR decision CRUD and scoped visibility\\
        \texttt{/api/improvement-plans} & GET, POST, PUT, DELETE & Improvement plans linked to final evaluations\\
        \texttt{/api/bonus-penalty} & GET, POST, PUT & Bonus and penalty creation, approval, eligible evaluations\\
        \texttt{/api/career} & GET, POST, PUT, DELETE & Competencies, career paths, development actions, recommendations\\
        \texttt{/api/ai} & GET, POST & Goal/KPI suggestions, review drafts, development plans, prediction endpoints\\
        \texttt{/api/stats} & GET & Dashboard statistics, performance stats, objective status, users by role, score distribution\\
        \texttt{/api/reports} & GET & Cycle and team reports\\
        \texttt{/api/audit-logs} & GET & Audit log queries and entity history\\
        \texttt{/api/notifications} & GET, POST, DELETE & Notifications, unread count, read flags\\
        \texttt{/api/calendar} & GET, POST, DELETE & Calendar providers, connection, callback, events\\
        \texttt{/api/meetings} & GET, POST, PUT, DELETE & Meetings, duplication, action items\\
        \texttt{/api/pdf} & GET & Team and user PDF generation\\
        \bottomrule
        \end{longtable}
    """)

    w("appendices/database-dictionary.tex", r"""
        \chapter{Database Dictionary}
        \begin{longtable}{p{0.22\textwidth}p{0.28\textwidth}p{0.4\textwidth}}
        \caption{Main MongoDB/Mongoose entities.}\label{tab:database-dictionary}\\
        \toprule
        Entity & Key fields & Notes\\
        \midrule
        \endfirsthead
        \toprule
        Entity & Key fields & Notes\\
        \midrule
        \endhead
        User & name, email, password, role, team, manager, isActive, refreshToken & Email validator requires \texttt{@biat.com}; password hashed before save\\
        Team & name, leader, members, parentTeam, createdBy & Parent-team reference supports subteams\\
        Cycle & name, year, status, phase dates, currentPhase & Year is unique; phase dates sequential\\
        Objective & title, owner, cycle, category, team, assignedUsers, weight, status, KPIs & Embedded KPIs, comments, activity logs, change requests\\
        Task & assignee, assignedBy, status, workflowStage, progress, linkedGoal, timeTracking & Kanban and time tracking support\\
        CheckIn & objective, employee, cycle, progress, status, attachments, history & Manager review and attachment workflow\\
        Evaluation & employeeId, evaluatorId, cycleId, status, suggestedScore, finalScore & General evaluation workflow with approval history\\
        FinalEvaluation & employee, cycle, auto score, manager score, final score, rating, HR status & Main annual final review and HR validation model\\
        HRDecision & user, cycle, finalEvaluation, finalScore, action & One decision per user and cycle\\
        ImprovementPlan & evaluation, employee, cycle, objective goal, deadline, expected outcome & Follow-up plans after evaluation\\
        BonusPenalty & employee, type, value, reason, finalEvaluation, approvalStatus & Bonus or penalty records\\
        Feedback & sender/recipient fields, type, message, rating & Feedback exchange and stats\\
        Meeting & organizer, attendees, date/time, action items & Meeting management and follow-up\\
        AuditLog & user, action, entityType, entityId, description, metadata, timestamp & Traceability and compliance support\\
        Notification & recipient, type, title, message, read state & In-app notification flow\\
        CareerPath/Recommendation/Competency & user, competencies, actions, suggested path, skills & Career development module\\
        \bottomrule
        \end{longtable}
    """)

    w("appendices/installation-guide.tex", r"""
        \chapter{Installation Guide}
        \section{Prerequisites}
        The project requires Node.js, npm, MongoDB access, Python with the AI dependencies when the prediction service is used, Docker for container builds, and Kubernetes tooling for cluster deployment.

        \section{Backend}
        \begin{lstlisting}[language=bash]
        cd backend
        npm ci
        # create .env with MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET
        npm run dev
        \end{lstlisting}

        \section{Frontend}
        \begin{lstlisting}[language=bash]
        cd frontend
        npm ci
        npm run dev
        \end{lstlisting}

        \section{AI Service}
        \begin{lstlisting}[language=bash]
        cd ai-service
        pip install -r requirements.txt
        python app.py
        \end{lstlisting}

        \section{Docker Compose}
        \begin{lstlisting}[language=bash]
        docker compose up --build
        \end{lstlisting}
        The Compose file builds the backend and frontend only. The AI service must be run separately unless deployment files are extended.
    """)

    w("appendices/test-evidence.tex", r"""
        \chapter{Test Evidence}
        \section{Backend Tests}
        Local command:
        \begin{lstlisting}[language=bash]
        cd backend
        npm test -- --runInBand
        \end{lstlisting}
        Result: 9 test suites passed, 45 tests passed.

        \section{Frontend Tests}
        Local command:
        \begin{lstlisting}[language=bash]
        cd frontend
        npm test -- --runInBand
        \end{lstlisting}
        Result: 5 test suites passed, 14 tests passed.

        \section{Frontend Build}
        Local command:
        \begin{lstlisting}[language=bash]
        cd frontend
        npm run build
        \end{lstlisting}
        Result: Vite build succeeded and transformed 881 modules.

        \section{AI Artifact Evaluation}
        The saved AI models were evaluated against the repository dataset split with \texttt{random\_state=42} and stratification. The XGBoost rating model achieved 0.9780 accuracy. The XGBoost promotion model achieved 0.7480 accuracy and 0.8218 ROC-AUC. These metrics describe the included synthetic dataset only.
    """)

    w("bibliography/references.bib", r"""
        @online{reactDocs,
          title={React Documentation},
          organization={Meta Open Source},
          url={https://react.dev/},
          urldate={2026-07-21}
        }
        @online{viteDocs,
          title={Vite Guide},
          organization={Vite},
          url={https://vite.dev/guide/},
          urldate={2026-07-21}
        }
        @online{expressDocs,
          title={Express.js Routing Guide},
          organization={OpenJS Foundation},
          url={https://expressjs.com/en/5x/guide/routing/},
          urldate={2026-07-21}
        }
        @online{mongooseSchemas,
          title={Mongoose Schemas Guide},
          organization={Mongoose},
          url={https://mongoosejs.com/docs/guide.html},
          urldate={2026-07-21}
        }
        @online{mongodbDocs,
          title={Databases and Collections in MongoDB},
          organization={MongoDB},
          url={https://www.mongodb.com/docs/manual/core/databases-and-collections/},
          urldate={2026-07-21}
        }
        @misc{rfc7519,
          title={RFC 7519: JSON Web Token (JWT)},
          author={Jones, Michael and Bradley, John and Sakimura, Nat},
          year={2015},
          howpublished={IETF},
          url={https://datatracker.ietf.org/doc/html/rfc7519}
        }
        @online{owaspApi,
          title={OWASP API Security Top 10 2023},
          organization={OWASP},
          url={https://owasp.org/API-Security/editions/2023/en/0x11-t10/},
          urldate={2026-07-21}
        }
        @online{nist80063b,
          title={Digital Identity Guidelines: Authentication and Lifecycle Management},
          organization={NIST},
          url={https://pages.nist.gov/800-63-4/sp800-63b.html},
          urldate={2026-07-21}
        }
        @online{flaskDocs,
          title={Flask Quickstart},
          organization={Pallets},
          url={https://flask.palletsprojects.com/en/stable/quickstart/},
          urldate={2026-07-21}
        }
        @online{sklearnRF,
          title={RandomForestClassifier},
          organization={scikit-learn},
          url={https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html},
          urldate={2026-07-21}
        }
        @online{xgboostDocs,
          title={XGBoost Documentation},
          organization={XGBoost},
          url={https://xgboost.readthedocs.io/},
          urldate={2026-07-21}
        }
        @online{dockerDocs,
          title={Dockerfile Reference},
          organization={Docker},
          url={https://docs.docker.com/reference/dockerfile/},
          urldate={2026-07-21}
        }
        @online{kubernetesDeployments,
          title={Kubernetes Deployments},
          organization={Kubernetes},
          url={https://kubernetes.io/docs/concepts/workloads/controllers/deployment/},
          urldate={2026-07-21}
        }
        @online{kustomizeDocs,
          title={Declarative Management of Kubernetes Objects Using Kustomize},
          organization={Kubernetes},
          url={https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/},
          urldate={2026-07-21}
        }
        @online{argoDocs,
          title={Argo CD Automated Sync Policy},
          organization={Argo CD},
          url={https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/},
          urldate={2026-07-21}
        }
        @online{githubActionsDocs,
          title={Workflow Syntax for GitHub Actions},
          organization={GitHub},
          url={https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions},
          urldate={2026-07-21}
        }
    """)

    w("README_BUILD.md", r"""
        # Build Instructions

        Build from this directory:

        ```powershell
        latexmk -pdf -interaction=nonstopmode main.tex
        ```

        The expected output is `main.pdf`.

        The report uses `pdflatex`, `biblatex`, and `biber` through `latexmk`.
    """)

    w("MISSING_INFORMATION.md", r"""
        # Missing Information

        The following information was not available in the repository and must be completed manually:

        - Student name
        - University or engineering school name
        - Degree name
        - Academic supervisor name
        - Professional supervisor name
        - Host organization name
        - Internship period and exact development dates
        - University logo
        - Company logo
        - Report validation date and signature
        - Optional personal dedication

        Screenshot capture was not performed because the repository does not provide a guaranteed seeded authenticated runtime session. Recommended screenshots to capture later:

        - Login screen
        - Dashboard
        - Objective management
        - Objective details with KPIs
        - Task kanban board
        - Mid-year check-ins
        - Final evaluation manager view
        - HR validation queue
        - Performance prediction page
        - Analytics page
        - Audit logs
    """)

    w("REPORT_EVIDENCE.md", r"""
        # Report Evidence Map

        | Report claim | Repository evidence |
        |---|---|
        | The frontend uses React and Vite | `frontend/package.json`, `frontend/vite.config.js` |
        | The backend uses Express and Mongoose | `backend/package.json`, `backend/app.js`, `backend/models/*.js` |
        | MongoDB is the data store | `backend/server.js`, `backend/config/db.js`, Mongoose models |
        | Authentication uses JWT and refresh tokens | `backend/routes/auth.js`, `backend/middleware/auth.js`, `frontend/src/components/AuthContext.jsx` |
        | Passwords are hashed with bcrypt | `backend/models/User.js` |
        | Roles are ADMIN, HR, TEAM_LEADER, COLLABORATOR | `backend/models/User.js`, `backend/validators/schemas.js` |
        | Backend route-level RBAC exists | `backend/middleware/role.js`, `backend/routes/*.js` |
        | Frontend route roles exist | `frontend/src/routes/routeConfig.jsx` |
        | Teams support subteams | `backend/models/Team.js`, `backend/routes/teams.js`, `backend/utils/accessControl.js` |
        | Cycles have phases phase1, phase2, phase3, closed | `backend/models/Cycle.js`, `backend/routes/cycles.js` |
        | Objectives embed KPIs | `backend/models/Objective.js` |
        | Objective score is weight times achievement divided by 100 | `backend/models/Objective.js`, `backend/services/scoreCalculationService.js` |
        | Final score normalizes non-100 weight totals | `backend/services/scoreCalculationService.js`, `backend/tests/scoreCalculationService.test.js` |
        | Team objective weight is not divided by member count | `backend/tests/scoreCalculationService.test.js`, `backend/tests/objectiveRules.test.js` |
        | Check-ins include manager review | `backend/models/CheckIn.js`, `backend/controllers/checkInController.js` |
        | Tasks include kanban states and time tracking | `backend/models/Task.js`, `frontend/src/pages/TasksPage.jsx` |
        | Final evaluations include HR validation | `backend/models/FinalEvaluation.js`, `backend/routes/finalEvaluations.js`, `backend/controllers/finalEvaluationController.js` |
        | HR decisions, improvement plans, and bonus/penalty records exist | `backend/models/HRDecision.js`, `backend/models/ImprovementPlan.js`, `backend/models/BonusPenalty.js` |
        | Generative AI supports multiple providers and fallbacks | `backend/services/aiService.js`, `backend/controllers/aiController.js` |
        | Python AI service uses Flask, Random Forest, and XGBoost artifacts | `ai-service/app.py`, `ai-service/train_model.py`, `ai-service/models/*.joblib` |
        | AI dataset is synthetic with 10,000 rows | `ai-service/README.md`, `ai-service/data/employee_performance_dataset.csv` |
        | Backend tests passed locally | `backend/tests/*.js`, local command `npm test -- --runInBand` |
        | Frontend tests passed locally | `frontend/tests/*.jsx`, local command `npm test -- --runInBand` |
        | Frontend build succeeded locally | local command `npm run build` in `frontend` |
        | CI/CD uses GitHub Actions, Gitleaks, tests, Docker builds, Trivy, and smoke test | `.github/workflows/docker-build.yml` |
        | Containerization exists for backend and frontend | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |
        | Kubernetes and GitOps files exist | `k8s/base/*.yaml`, `k8s/overlays/*`, `k8s/argocd-app.yaml` |
    """)

    w("FINAL_QA_REPORT.md", r"""
        # Final QA Report

        This file is updated after compilation. Initial checks completed before writing:

        - Repository scanned.
        - Core package manifests inspected.
        - Mongoose models inspected.
        - Route inventory collected.
        - Security middleware inspected.
        - Scoring and workflow rules inspected.
        - AI service files and saved artifact metrics inspected.
        - Backend tests passed: 9 suites, 45 tests.
        - Frontend tests passed: 5 suites, 14 tests.
        - Frontend build succeeded.
    """)

    w("screenshots/README.md", r"""
        # Screenshots

        Runtime screenshots were not captured because the repository does not provide a guaranteed seeded, authenticated browser session. The LaTeX report contains clearly labelled screenshot placeholders, and `MISSING_INFORMATION.md` lists the exact views to capture.
    """)


if __name__ == "__main__":
    main()
