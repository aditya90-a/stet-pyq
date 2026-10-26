"""Subject -> topic -> subtopic taxonomy.

Computer Science topics are the 15 units of `syllabus.jpeg` found in the source folder (an
unofficial screenshot of the STET 1/2 Computer Science syllabus and exam pattern).  Subtopics and
the non-CS subject structure are this project's own breakdown, derived from the questions
actually present in the papers.
"""
from __future__ import annotations

import re

SYLLABUS_SOURCE = {
    "file": "syllabus.jpeg",
    "description": "Screenshot in the source folder titled 'STET 1/2 Computer Science Syllabus' with an 'Exam Pattern STET Paper 1/2' table. "
    "It is not an official BSEB notification; units and section sizes have not been verified against the official notice.",
    "examPattern": [
        {"subject": "Computer Science", "questions": 100, "marks": 100},
        {"subject": "Art of Teaching", "questions": 30, "marks": 30},
        {"subject": "General Knowledge", "questions": 5, "marks": 5},
        {"subject": "Environmental Science", "questions": 5, "marks": 5},
        {"subject": "Mathematical Aptitude", "questions": 5, "marks": 5},
        {"subject": "Logical Reasoning", "questions": 5, "marks": 5},
    ],
    "notes": ["Language of Exam: Hindi/English", "Negative Marking: No", "Duration: 150 Minutes"],
}

TAXONOMY: dict[str, dict[str, list[str]]] = {
    "Computer Science": {
        "Digital Logic": [
            "Number Systems & Binary Arithmetic",
            "Data Representation & Error Codes",
            "Boolean Algebra & K-Maps",
            "Logic Gates & Logic Families",
            "Combinational Circuits",
            "Sequential Circuits (Flip-flops, Counters, Registers)",
            "Memory Devices & Programmable Logic (ROM/RAM/PLA/PLD)",
        ],
        "Computer Organization and Architecture": [
            "CPU Organization & Registers",
            "Instruction Set & Addressing Modes",
            "Memory Hierarchy & Cache",
            "I/O Organization, Interrupts & DMA",
            "Pipelining & Parallel Processing",
            "Microprocessors & Microcontrollers",
        ],
        "Programming and Data Structure": [
            "Programming Fundamentals (C/C++)",
            "Python Programming",
            "Arrays & Strings",
            "Pointers & Memory Allocation",
            "Linked Lists",
            "Stacks & Queues",
            "Trees & Binary Search Trees",
            "Graphs (Representation & Traversal)",
            "Hashing",
        ],
        "Algorithms": [
            "Asymptotic Analysis & Complexity",
            "Recurrences & Divide and Conquer",
            "Sorting & Searching",
            "Greedy Algorithms",
            "Dynamic Programming",
            "Graph Algorithms (MST, Shortest Paths)",
            "Complexity Classes (P, NP, NP-Complete)",
        ],
        "Operating System": [
            "OS Concepts, Types & System Calls",
            "Processes & Threads",
            "CPU Scheduling",
            "Synchronization & Deadlocks",
            "Memory Management & Virtual Memory",
            "File Systems & Disk Management",
            "Protection & Security",
        ],
        "Database Management System": [
            "DBMS Concepts & Architecture",
            "ER Model & Data Models",
            "Relational Model & Relational Algebra",
            "SQL",
            "Keys, Functional Dependencies & Normalization",
            "Transactions & Concurrency Control",
            "Indexing, Storage & File Organization",
        ],
        "Computer Network": [
            "Network Models (OSI / TCP-IP)",
            "Physical Layer & Transmission Media",
            "Data Link Layer, MAC & Error Control",
            "Network Layer, IP Addressing & Routing",
            "Transport Layer (TCP/UDP)",
            "Application Layer Protocols",
            "Network Devices & Topologies",
            "Network Security & Cryptography",
            "Wireless & Mobile Networks",
        ],
        "Software Engineering": [
            "SDLC & Process Models",
            "Requirements Engineering",
            "Software Design, Modelling & UML",
            "Software Testing",
            "Project Management, Estimation & Metrics",
            "Maintenance, Quality & Configuration Management",
        ],
        "Object Oriented Programming": [
            "OOP Concepts (Classes & Objects)",
            "Inheritance",
            "Polymorphism & Overloading",
            "Encapsulation & Abstraction",
            "Constructors, Destructors & Memory",
            "Exception Handling",
            "Java / C++ Language Features",
        ],
        "Web-Based Application Development": [
            "HTML",
            "CSS",
            "JavaScript & Client-side Scripting",
            "XML & Data Formats",
            "Server-side Programming & Web Servers",
            "HTTP, URLs & Web Architecture",
        ],
        "Theory of Computation": [
            "Finite Automata & Regular Languages",
            "Regular Expressions",
            "Context-Free Grammars & Pushdown Automata",
            "Turing Machines & Decidability",
            "Chomsky Hierarchy & Language Properties",
        ],
        "Internet of Things": [
            "IoT Concepts & Architecture",
            "Sensors, Actuators & Hardware Platforms",
            "IoT Communication Protocols",
            "IoT Applications & Security",
        ],
        "Artificial Intelligence": [
            "AI Foundations & Intelligent Agents",
            "Search Strategies",
            "Knowledge Representation & Logic",
            "Machine Learning",
            "Neural Networks & Deep Learning",
            "Expert Systems, NLP & Fuzzy Logic",
        ],
        "Fundamental of E-Commerce": [
            "E-Commerce Concepts & Business Models",
            "Electronic Payment Systems",
            "E-Commerce Security & Cyber Law",
            "Online Marketing, M-Commerce & EDI",
        ],
        "Multimedia": [
            "Multimedia Elements & Hypermedia",
            "Images, Graphics & Colour Models",
            "Audio & Audio Compression",
            "Video, Animation & Video Compression",
            "Multimedia File Formats & Standards",
            "Streaming & Multimedia Networking",
        ],
        "Computer Fundamentals (not a listed unit)": [
            "Computer Basics & Generations",
            "Software, Applications & Office Tools",
            "Internet, Email & Cyber Security Awareness",
        ],
    },
    "Art of Teaching": {
        "Teaching Methods & Strategies": ["Teaching Methods", "Learner-centred & Activity-based Learning", "Questioning & Discussion Techniques"],
        "Lesson Planning & Micro-teaching": ["Lesson Planning", "Micro-teaching & Teaching Skills", "Levels & Phases of Teaching"],
        "Learning & Educational Psychology": ["Learning Theories", "Motivation & Attribution", "Intelligence & Individual Differences", "Child Development"],
        "Assessment & Evaluation": ["Formative & Summative Evaluation", "Test Construction & Item Types", "Evaluation Techniques & Tools"],
        "Curriculum": ["Curriculum Design & Development", "Nature & Determinants of Curriculum"],
        "Teaching Aids, ICT & Library": ["Audio-Visual Aids", "ICT in Education", "Library & Learning Resources"],
        "Teacher, Classroom & School": ["Qualities & Role of a Teacher", "Classroom Management", "School Administration"],
        "Objectives of Education & Taxonomy": ["Aims & Objectives", "Bloom's Taxonomy & Learning Domains"],
        "Educational Thinkers & Philosophy": ["Educational Thinkers", "Philosophical Foundations"],
        "Inclusive Education & Diversity": ["Inclusive Education", "Diverse Learners & Accessibility"],
        "Educational Research & Statistics": ["Research Methods", "Sampling & Statistics"],
        "Values, Environment & Society in Education": ["Values & Democracy in Education", "Environmental Awareness in Education"],
    },
    "General Knowledge": {
        "History & Freedom Movement": ["Ancient & Medieval India", "Modern India & Freedom Struggle"],
        "Geography": ["Indian Geography", "Physical & World Geography"],
        "Polity & Governance": ["Constitution & Polity", "Governance & Institutions"],
        "Economy": ["Indian Economy", "Basic Economic Concepts"],
        "Bihar GK": ["Bihar History & Culture", "Bihar Geography & Current Affairs"],
        "Current Affairs & Miscellaneous": ["Current Affairs", "Static GK"],
    },
    "Environmental Science": {
        "Living World": ["Plants & Animals", "Human Body, Food & Health"],
        "Physical & Chemical Environment": ["Materials & Everyday Science", "Energy & Physical Phenomena"],
        "Environment & Ecology": ["Ecology, Pollution & Conservation", "Natural Disasters & Climate"],
    },
    "Mathematical Aptitude": {
        "Arithmetic": ["Number System & Operations", "Fractions & Decimals", "Word Problems"],
        "Geometry & Mensuration": ["Shapes & Mensuration"],
        "Number Patterns": ["Number Series"],
    },
    "Logical Reasoning": {
        "Verbal Reasoning": ["Coding-Decoding", "Analogy & Classification (Odd One Out)", "Series Completion"],
        "Analytical Reasoning": ["Direction Sense", "Blood Relations", "Mathematical Operations & Symbols", "Venn Diagrams & Figures"],
    },
}

UNCLASSIFIED = "Unclassified"


def subtopic_exists(subject: str, topic: str, subtopic: str) -> bool:
    return subtopic in TAXONOMY.get(subject, {}).get(topic, [])


def topic_exists(subject: str, topic: str) -> bool:
    return topic in TAXONOMY.get(subject, {})


def section_subject(qno: int) -> str:
    """Section by position (all ten papers follow the 100 + 30 + 20 layout)."""
    if qno <= 100:
        return "Computer Science"
    if qno <= 130:
        return "Art of Teaching"
    return "General Knowledge / Aptitude"


# ---------------------------------------------------------------------------
# Deterministic keyword fallback (used only when no reviewed annotation exists)
# ---------------------------------------------------------------------------
_CS_RULES: list[tuple[str, str, str]] = [
    # (regex, topic, subtopic) - first match wins
    (r"k-?map|karnaugh|boolean (function|expression|algebra)|\bsop\b|\bpos\b|minterm|maxterm|de ?morgan", "Digital Logic", "Boolean Algebra & K-Maps"),
    (r"flip-?flop|counter|shift register|latch", "Digital Logic", "Sequential Circuits (Flip-flops, Counters, Registers)"),
    (r"multiplexer|demultiplexer|decoder|encoder|half-?adder|full-?adder|comparator|subtractor", "Digital Logic", "Combinational Circuits"),
    (r"\bpla\b|\bpal\b|\bpld\b|eprom|eeprom|\brom\b", "Digital Logic", "Memory Devices & Programmable Logic (ROM/RAM/PLA/PLD)"),
    (r"\bttl\b|\becl\b|cmos|logic famil|nand|\bnor\b|xor|logic gate", "Digital Logic", "Logic Gates & Logic Families"),
    (r"hamming|parity|gray code|bcd|excess-?3|ascii|unicode", "Digital Logic", "Data Representation & Error Codes"),
    (r"binary|octal|hexadecimal|complement|decimal number", "Digital Logic", "Number Systems & Binary Arithmetic"),
    (r"microcontroller|microprocessor|8085|8086|arduino", "Computer Organization and Architecture", "Microprocessors & Microcontrollers"),
    (r"cache|memory hierarch|virtual address|main memory", "Computer Organization and Architecture", "Memory Hierarchy & Cache"),
    (r"pipelin|superscalar|parallel process", "Computer Organization and Architecture", "Pipelining & Parallel Processing"),
    (r"addressing mode|instruction (set|format)|risc|cisc|opcode", "Computer Organization and Architecture", "Instruction Set & Addressing Modes"),
    (r"\bdma\b|interrupt|i/o", "Computer Organization and Architecture", "I/O Organization, Interrupts & DMA"),
    (r"register|\balu\b|accumulator|program counter|control unit", "Computer Organization and Architecture", "CPU Organization & Registers"),
    (r"finite automat|\bdfa\b|\bnfa\b|regular language", "Theory of Computation", "Finite Automata & Regular Languages"),
    (r"regular expression", "Theory of Computation", "Regular Expressions"),
    (r"context-?free|grammar|pushdown|\bpda\b|production", "Theory of Computation", "Context-Free Grammars & Pushdown Automata"),
    (r"turing|decidab|halting", "Theory of Computation", "Turing Machines & Decidability"),
    (r"chomsky", "Theory of Computation", "Chomsky Hierarchy & Language Properties"),
    (r"np-?complete|np-?hard|\bp vs np|polynomial time|satisfiab", "Algorithms", "Complexity Classes (P, NP, NP-Complete)"),
    (r"dynamic programming|memoiz|knapsack|longest common", "Algorithms", "Dynamic Programming"),
    (r"greedy|huffman", "Algorithms", "Greedy Algorithms"),
    (r"spanning tree|kruskal|prim|dijkstra|bellman|floyd|shortest path", "Algorithms", "Graph Algorithms (MST, Shortest Paths)"),
    (r"sort|binary search|linear search", "Algorithms", "Sorting & Searching"),
    (r"asymptotic|big-?o|omega|theta|time complexity|space complexity", "Algorithms", "Asymptotic Analysis & Complexity"),
    (r"recurrence|divide and conquer|master theorem", "Algorithms", "Recurrences & Divide and Conquer"),
    (r"linked list", "Programming and Data Structure", "Linked Lists"),
    (r"stack|queue|deque|postfix|prefix|infix", "Programming and Data Structure", "Stacks & Queues"),
    (r"\bbst\b|binary tree|avl|b-?tree|heap|tree traversal|inorder|preorder|postorder", "Programming and Data Structure", "Trees & Binary Search Trees"),
    (r"graph|bfs|dfs|adjacency", "Programming and Data Structure", "Graphs (Representation & Traversal)"),
    (r"hash", "Programming and Data Structure", "Hashing"),
    (r"pointer|malloc|calloc|free\(", "Programming and Data Structure", "Pointers & Memory Allocation"),
    (r"python", "Programming and Data Structure", "Python Programming"),
    (r"array|string", "Programming and Data Structure", "Arrays & Strings"),
    (r"deadlock|semaphore|mutex|critical section|race condition|synchroniz", "Operating System", "Synchronization & Deadlocks"),
    (r"scheduling|round robin|fcfs|sjf|starvation", "Operating System", "CPU Scheduling"),
    (r"paging|page fault|segmentation|thrashing|virtual memory|fragmentation", "Operating System", "Memory Management & Virtual Memory"),
    (r"file system|\bfat\b|inode|disk|directory", "Operating System", "File Systems & Disk Management"),
    (r"process|thread|context switch", "Operating System", "Processes & Threads"),
    (r"operating system|kernel|system call|\bos\b", "Operating System", "OS Concepts, Types & System Calls"),
    (r"normal form|normaliz|functional dependenc|\bbcnf\b|candidate key|primary key|foreign key|super key", "Database Management System", "Keys, Functional Dependencies & Normalization"),
    (r"transaction|acid|concurrency|serializab|two-phase|rollback|commit", "Database Management System", "Transactions & Concurrency Control"),
    (r"\bsql\b|select|join|ddl|dml|crud", "Database Management System", "SQL"),
    (r"relational algebra|tuple|relation|projection", "Database Management System", "Relational Model & Relational Algebra"),
    (r"\ber\b|entity|attribute|data model", "Database Management System", "ER Model & Data Models"),
    (r"index|b\+ ?tree|file organization", "Database Management System", "Indexing, Storage & File Organization"),
    (r"database|dbms|dba|schema", "Database Management System", "DBMS Concepts & Architecture"),
    (r"\bosi\b|tcp/ip model|layer", "Computer Network", "Network Models (OSI / TCP-IP)"),
    (r"\bip address|subnet|routing|router|ipv4|ipv6|\bnat\b", "Computer Network", "Network Layer, IP Addressing & Routing"),
    (r"\btcp\b|\budp\b|port number|congestion", "Computer Network", "Transport Layer (TCP/UDP)"),
    (r"\bdns\b|http|ftp|smtp|pop3|imap|dhcp|telnet", "Computer Network", "Application Layer Protocols"),
    (r"\bmac\b|csma|aloha|ethernet|crc|sliding window", "Computer Network", "Data Link Layer, MAC & Error Control"),
    (r"encrypt|cryptograph|firewall|rsa|digital signature|cipher", "Computer Network", "Network Security & Cryptography"),
    (r"wireless|wi-?fi|bluetooth|gsm|mobile network", "Computer Network", "Wireless & Mobile Networks"),
    (r"topolog|hub|switch|bridge|gateway|repeater", "Computer Network", "Network Devices & Topologies"),
    (r"fiber|coaxial|twisted pair|bandwidth|modulation|multiplex", "Computer Network", "Physical Layer & Transmission Media"),
    (r"waterfall|spiral|agile|sdlc|prototype model|scrum", "Software Engineering", "SDLC & Process Models"),
    (r"testing|test case|white box|black box", "Software Engineering", "Software Testing"),
    (r"requirement", "Software Engineering", "Requirements Engineering"),
    (r"uml|coupling|cohesion|dfd|design pattern", "Software Engineering", "Software Design, Modelling & UML"),
    (r"cocomo|function point|estimation|project management|risk", "Software Engineering", "Project Management, Estimation & Metrics"),
    (r"maintenance|cmm|quality assurance|configuration management", "Software Engineering", "Maintenance, Quality & Configuration Management"),
    (r"inherit", "Object Oriented Programming", "Inheritance"),
    (r"polymorph|overload|overrid|virtual function", "Object Oriented Programming", "Polymorphism & Overloading"),
    (r"encapsulat|abstraction|information hiding|abstract class|interface", "Object Oriented Programming", "Encapsulation & Abstraction"),
    (r"constructor|destructor", "Object Oriented Programming", "Constructors, Destructors & Memory"),
    (r"exception", "Object Oriented Programming", "Exception Handling"),
    (r"\bclass\b|object", "Object Oriented Programming", "OOP Concepts (Classes & Objects)"),
    (r"\bhtml\b|<\w+>|tag", "Web-Based Application Development", "HTML"),
    (r"\bcss\b|stylesheet", "Web-Based Application Development", "CSS"),
    (r"javascript|\bdom\b|ajax", "Web-Based Application Development", "JavaScript & Client-side Scripting"),
    (r"\bxml\b|json|dtd", "Web-Based Application Development", "XML & Data Formats"),
    (r"php|asp|jsp|servlet|web server|server-side", "Web-Based Application Development", "Server-side Programming & Web Servers"),
    (r"\biot\b|internet of things|mqtt|coap|zigbee|rfid|sensor|actuator", "Internet of Things", "IoT Concepts & Architecture"),
    (r"neural|deep learning|perceptron", "Artificial Intelligence", "Neural Networks & Deep Learning"),
    (r"machine learning|supervised|unsupervised|regression|classification|cluster", "Artificial Intelligence", "Machine Learning"),
    (r"heuristic|a\*|search algorithm|minimax|alpha-?beta|hill climbing", "Artificial Intelligence", "Search Strategies"),
    (r"expert system|natural language|\bnlp\b|fuzzy", "Artificial Intelligence", "Expert Systems, NLP & Fuzzy Logic"),
    (r"predicate|propositional|knowledge representation|inference|resolution|entail", "Artificial Intelligence", "Knowledge Representation & Logic"),
    (r"artificial intelligence|\bai\b|agent|turing test", "Artificial Intelligence", "AI Foundations & Intelligent Agents"),
    (r"payment|e-?cash|credit card|wallet|upi", "Fundamental of E-Commerce", "Electronic Payment Systems"),
    (r"e-?commerce|b2b|b2c|c2c|online shop", "Fundamental of E-Commerce", "E-Commerce Concepts & Business Models"),
    (r"\bedi\b|m-?commerce|e-?marketing", "Fundamental of E-Commerce", "Online Marketing, M-Commerce & EDI"),
    (r"jpeg|mpeg|gif|png|bitmap|pixel|rgb|cmyk|resolution|vector graphic", "Multimedia", "Images, Graphics & Colour Models"),
    (r"audio|midi|sampling|mp3|sound", "Multimedia", "Audio & Audio Compression"),
    (r"video|animation|frame", "Multimedia", "Video, Animation & Video Compression"),
    (r"stream|rtsp|rtp|jitter", "Multimedia", "Streaming & Multimedia Networking"),
    (r"multimedia|hypermedia|hypertext", "Multimedia", "Multimedia Elements & Hypermedia"),
]
_CS_RULES_C = [(re.compile(rx, re.I), t, s) for rx, t, s in _CS_RULES]


def keyword_classify(subject: str, text: str) -> tuple[str, str] | None:
    if subject != "Computer Science":
        return None
    for rx, topic, sub in _CS_RULES_C:
        if rx.search(text):
            return topic, sub
    return None
