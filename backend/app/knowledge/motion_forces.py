"""
Module Knowledge Base — structured knowledge for the Motion & Forces module.

Each node has:
  - core_concepts: key ideas the student should learn
  - misconception_paths: common mistakes + micro-question sequences
  - depth_progression: 5 stages from intuition to advanced theory
  - leads_to_nodes: recommended next nodes
  - bridges_to_modules: cross-module connections
"""

MOTION_FORCES_KNOWLEDGE: dict = {
    # ── Node 1: What is Motion? ─────────────────────────────────────────
    "what_is_motion": {
        "node_id": "what_is_motion",
        "module_id": "motion_forces",
        "display_name": "What is Motion?",

        "core_concepts": {
            "relative_motion": "Change in position depends on reference frame",
            "reference_frame": "Coordinate system from which motion is observed",
            "galilean_relativity": "Laws of motion are the same in all inertial frames",
            "independence_of_motion": "Perpendicular components of motion are independent",
        },

        "misconception_paths": {
            "vertical_only_reasoning": {
                "description": "Student ignores horizontal velocity component",
                "detection_keywords": ["straight down", "drops straight", "only gravity", "falls vertically"],
                "micro_questions": [
                    "Before the ball was dropped, was it moving with the ship?",
                    "When released, does that forward motion instantly disappear?",
                    "Does gravity act horizontally or vertically?",
                ],
                "final_concept": "Horizontal and vertical motion are independent.",
                "closure_modes": {
                    "summary": "So the key idea is: Horizontal and vertical motions are independent. Gravity changes vertical motion but doesn't erase horizontal motion.",
                    "analogy": "It's like throwing a ball inside a moving train. To someone inside, it goes straight up and down. To someone outside, it follows a curved path. Same event, different perspectives.",
                    "challenge": "If the ship suddenly stopped while the ball was mid-air — where would it land?",
                },
            },
            "motion_requires_force": {
                "description": "Student thinks continuous force is needed for motion",
                "detection_keywords": ["need force", "requires force", "force to move", "push to keep", "keeps pushing"],
                "micro_questions": [
                    "After you throw a ball, are you still touching it?",
                    "If no force acts on it, does it stop immediately?",
                    "What would happen in space with no friction?",
                ],
                "final_concept": "Objects maintain constant velocity without force (Newton's First Law)",
                "closure_modes": {
                    "summary": "An object in motion stays in motion unless acted upon by a force. This is inertia.",
                    "analogy": "Think of a hockey puck on ice. You hit it once, then it glides. No continuous push needed.",
                    "challenge": "Why do cars need engines to keep moving if motion doesn't require force?",
                },
            },
            "absolute_motion": {
                "description": "Student believes there is one 'true' state of motion",
                "detection_keywords": ["really moving", "actually stationary", "truly at rest", "absolute"],
                "micro_questions": [
                    "If you're on a smooth train with no windows, can you tell you're moving?",
                    "Is the Earth moving or standing still?",
                    "Moving relative to what?",
                ],
                "final_concept": "There is no absolute motion — only motion relative to a chosen reference frame.",
                "closure_modes": {
                    "summary": "Motion is always relative. There's no experiment you can do to determine 'absolute' motion. Every measurement requires a reference frame.",
                    "analogy": "You're sitting still reading this — but you're also hurtling through space at 30 km/s around the Sun. Both are true, just different frames.",
                    "challenge": "If all motion is relative, how did Einstein conclude the speed of light is the same for everyone?",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Intuitive understanding of relative motion", "language": "Motion depends on who's watching"},
            2: {"description": "Understand reference frames explicitly", "language": "Different reference frames see different velocities"},
            3: {"description": "Vector representation of velocity", "language": "v = dx/dt, velocity has components"},
            4: {"description": "Galilean transformation", "language": "v' = v − u (frame transformation)"},
            5: {"description": "Bridge to special relativity", "language": "Invariance of physical laws, c as universal constant"},
        },

        "leads_to_nodes": [
            {"node_id": "what_is_force", "reason": "Understand what causes changes in motion.", "estimated_time": 6},
            {"node_id": "speed_velocity", "reason": "Builds the mathematical structure behind motion.", "estimated_time": 7},
        ],

        "bridges_to_modules": [
            {"module_id": "special_relativity", "node_id": "einstein_postulates", "connection": "Galilean relativity → Einsteinian relativity"},
            {"module_id": "vectors", "node_id": "vector_components", "connection": "Intuitive components → Mathematical vectors"},
        ],
    },

    # ── Node 2: What is a Force? ────────────────────────────────────────
    "what_is_force": {
        "node_id": "what_is_force",
        "module_id": "motion_forces",
        "display_name": "What is a Force?",

        "core_concepts": {
            "force_as_interaction": "A force is an interaction between two objects",
            "contact_vs_non_contact": "Forces can act through direct contact or at a distance",
            "net_force": "The overall effect of multiple forces determines motion",
            "force_causes_acceleration": "Unbalanced force causes change in velocity",
        },

        "misconception_paths": {
            "force_means_motion": {
                "description": "Student thinks force always means movement",
                "detection_keywords": ["force means moving", "if force then moves", "force equals motion"],
                "micro_questions": [
                    "If you push against a wall with all your strength, does it move?",
                    "Are there forces acting on the wall even though it's still?",
                    "What must be true for an object to remain stationary despite forces acting on it?",
                ],
                "final_concept": "Forces can be balanced. An object at rest has zero net force, not zero force.",
                "closure_modes": {
                    "summary": "A force doesn't guarantee motion. When forces balance, the net force is zero, and the object stays at rest or moves at constant velocity.",
                    "analogy": "Think of a tug-of-war where both teams pull equally hard. Huge forces, but the rope doesn't move.",
                    "challenge": "A book sits on a table. Name every force acting on it and explain why it doesn't move.",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Forces as pushes and pulls", "language": "Something that makes stuff move or stop"},
            2: {"description": "Contact vs non-contact forces", "language": "Gravity pulls without touching; friction needs contact"},
            3: {"description": "Free body diagrams", "language": "Draw all forces as vectors on the object"},
            4: {"description": "Newton's Second Law quantification", "language": "F = ma, force is measured in Newtons"},
            5: {"description": "Field theory introduction", "language": "Forces arise from fields — gravitational, electromagnetic"},
        },

        "leads_to_nodes": [
            {"node_id": "types_of_forces", "reason": "Explore specific force types in depth.", "estimated_time": 9},
        ],

        "bridges_to_modules": [],
    },

    # ── Node 3: Speed & Velocity ────────────────────────────────────────
    "speed_velocity": {
        "node_id": "speed_velocity",
        "module_id": "motion_forces",
        "display_name": "Speed & Velocity",

        "core_concepts": {
            "speed_is_scalar": "Speed is the magnitude of velocity — it has no direction",
            "velocity_is_vector": "Velocity includes both speed and direction",
            "average_vs_instantaneous": "Average velocity is total displacement / time; instantaneous is the limit",
            "displacement_vs_distance": "Displacement is the shortest path; distance is total path traveled",
        },

        "misconception_paths": {
            "speed_equals_velocity": {
                "description": "Student treats speed and velocity as identical",
                "detection_keywords": ["same thing", "speed is velocity", "no difference"],
                "micro_questions": [
                    "If a car drives in a circle and returns to start, what is its displacement?",
                    "Its speed was 60 km/h the whole time. What was its average velocity?",
                    "So can speed and velocity have different values for the same trip?",
                ],
                "final_concept": "Speed is the magnitude of velocity. Velocity includes direction, so average velocity can be zero even when speed is not.",
                "closure_modes": {
                    "summary": "Speed tells you how fast; velocity tells you how fast and in what direction. A round trip has non-zero speed but zero average velocity.",
                    "analogy": "Speed is like saying 'I ran 5 km.' Velocity is like saying 'I ran 5 km north.' The direction changes everything.",
                    "challenge": "Can an object have constant speed but changing velocity? Give an example.",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Speed as distance per time", "language": "How fast something goes"},
            2: {"description": "Velocity as speed + direction", "language": "60 km/h north is different from 60 km/h south"},
            3: {"description": "Velocity as a vector", "language": "v = Δx/Δt as vectors, components along axes"},
            4: {"description": "Calculus definition", "language": "v(t) = dx/dt, instantaneous rate of change of position"},
            5: {"description": "Phase space and state", "language": "Position-velocity space, Hamiltonian mechanics preview"},
        },

        "leads_to_nodes": [
            {"node_id": "types_of_forces", "reason": "Connect velocity changes to forces.", "estimated_time": 9},
        ],

        "bridges_to_modules": [
            {"module_id": "vectors", "node_id": "vector_addition", "connection": "Velocity addition → vector addition rules"},
        ],
    },

    # ── Node 4: Types of Forces ─────────────────────────────────────────
    "types_of_forces": {
        "node_id": "types_of_forces",
        "module_id": "motion_forces",
        "display_name": "Types of Forces",

        "core_concepts": {
            "gravity": "Attractive force between any two masses; F = GMm/r²",
            "friction": "Opposes relative motion between surfaces; static vs kinetic",
            "normal_force": "Perpendicular contact force from a surface",
            "tension": "Pull transmitted through a string, rope, or rod",
        },

        "misconception_paths": {
            "gravity_only_on_earth": {
                "description": "Student thinks gravity only exists on Earth",
                "detection_keywords": ["only earth", "no gravity in space", "weightless means no gravity"],
                "micro_questions": [
                    "What keeps the Moon orbiting Earth instead of flying away?",
                    "Astronauts on the ISS feel weightless — but is gravity zero there?",
                    "How far from Earth do you need to go for gravity to truly be zero?",
                ],
                "final_concept": "Gravity is universal and never truly zero. Astronauts feel 'weightless' because they're in freefall, not because gravity vanished.",
                "closure_modes": {
                    "summary": "Gravity extends to infinity, weakening with distance squared. 'Weightlessness' in orbit is actually continuous free-fall around Earth.",
                    "analogy": "Imagine falling in an elevator with the cable cut. You and the elevator fall at the same rate — you feel weightless, but gravity is very much pulling you.",
                    "challenge": "If the ISS is in freefall, why doesn't it crash into Earth?",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Recognizing everyday forces", "language": "Gravity pulls you down, friction slows you"},
            2: {"description": "Categorizing forces", "language": "Contact vs non-contact, names and effects"},
            3: {"description": "Force equations", "language": "F = mg, f ≤ μN, Newton's third law pairs"},
            4: {"description": "Force decomposition", "language": "Breaking forces into components on inclined planes"},
            5: {"description": "Fundamental interactions", "language": "All forces reduce to four fundamental interactions"},
        },

        "leads_to_nodes": [
            {"node_id": "understanding_acceleration", "reason": "See how unbalanced forces cause acceleration.", "estimated_time": 7},
            {"node_id": "newtons_laws", "reason": "Formalise the relationship between force and motion.", "estimated_time": 12},
        ],

        "bridges_to_modules": [],
    },

    # ── Node 5: Understanding Acceleration ──────────────────────────────
    "understanding_acceleration": {
        "node_id": "understanding_acceleration",
        "module_id": "motion_forces",
        "display_name": "Understanding Acceleration",

        "core_concepts": {
            "acceleration_definition": "Rate of change of velocity — can be speeding up, slowing down, or changing direction",
            "deceleration_is_acceleration": "Slowing down is just negative acceleration",
            "uniform_acceleration": "Constant acceleration gives the kinematic equations",
            "centripetal_acceleration": "Changing direction at constant speed still requires acceleration",
        },

        "misconception_paths": {
            "acceleration_means_speeding_up": {
                "description": "Student thinks acceleration only means going faster",
                "detection_keywords": ["speeding up", "going faster", "accelerating means faster"],
                "micro_questions": [
                    "When you brake in a car, is your velocity changing?",
                    "If velocity is changing, what do we call that change?",
                    "Can acceleration point opposite to the direction of motion?",
                ],
                "final_concept": "Acceleration is any change in velocity — magnitude or direction. Braking and turning are both acceleration.",
                "closure_modes": {
                    "summary": "Acceleration means velocity is changing. That includes speeding up, slowing down, or turning. It's about change, not just increase.",
                    "analogy": "A car going around a roundabout at constant 30 km/h is accelerating — because its direction keeps changing.",
                    "challenge": "Is it possible to have maximum speed and maximum acceleration at the same time?",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Acceleration as 'getting faster or slower'", "language": "How quickly speed changes"},
            2: {"description": "Acceleration as change in velocity", "language": "Includes direction changes"},
            3: {"description": "Kinematic equations", "language": "v = u + at, s = ut + ½at²"},
            4: {"description": "Acceleration vectors", "language": "Tangential and centripetal components"},
            5: {"description": "Non-uniform acceleration", "language": "a(t) = dv/dt, jerk, higher derivatives"},
        },

        "leads_to_nodes": [
            {"node_id": "putting_it_together", "reason": "Synthesize forces, motion, and acceleration.", "estimated_time": 10},
        ],

        "bridges_to_modules": [],
    },

    # ── Node 6: Newton's Three Laws ─────────────────────────────────────
    "newtons_laws": {
        "node_id": "newtons_laws",
        "module_id": "motion_forces",
        "display_name": "Newton's Three Laws",

        "core_concepts": {
            "first_law_inertia": "An object stays at rest or in uniform motion unless acted upon by a net force",
            "second_law_fma": "F = ma — force equals mass times acceleration",
            "third_law_action_reaction": "Every action has an equal and opposite reaction",
            "inertial_frames": "Newton's laws hold only in inertial (non-accelerating) reference frames",
        },

        "misconception_paths": {
            "third_law_cancellation": {
                "description": "Student thinks action-reaction forces cancel out",
                "detection_keywords": ["cancel out", "cancel each other", "no motion because equal"],
                "micro_questions": [
                    "When you push a wall and it pushes back, do both forces act on the same object?",
                    "Action-reaction forces act on different objects — does that change whether they cancel?",
                    "If you push a shopping cart, the cart pushes back on you. Why does the cart still move?",
                ],
                "final_concept": "Action-reaction forces act on different objects, so they never cancel. Net force on each object is calculated separately.",
                "closure_modes": {
                    "summary": "The key distinction: action and reaction act on different objects. You calculate net force for each object individually.",
                    "analogy": "When you jump, you push Earth down and Earth pushes you up. Both are real forces — but your small mass accelerates a lot, while Earth's huge mass barely budges.",
                    "challenge": "A horse pulls a cart. The cart pulls back equally on the horse. How does anything ever move?",
                },
            },
        },

        "depth_progression": {
            1: {"description": "Laws as intuitive rules", "language": "Things keep doing what they're doing unless pushed"},
            2: {"description": "Formal law statements", "language": "Inertia, F = ma, action-reaction pairs"},
            3: {"description": "Quantitative problem solving", "language": "Calculate forces, masses, accelerations"},
            4: {"description": "System of particles", "language": "Internal vs external forces, center of mass"},
            5: {"description": "Limitations and extensions", "language": "Non-inertial frames, pseudo-forces, Lagrangian mechanics"},
        },

        "leads_to_nodes": [
            {"node_id": "putting_it_together", "reason": "Apply Newton's laws to real scenarios.", "estimated_time": 10},
        ],

        "bridges_to_modules": [
            {"module_id": "energy", "node_id": "work_energy_theorem", "connection": "F = ma → Work-energy theorem"},
        ],
    },

    # ── Node 7: Putting It Together ─────────────────────────────────────
    "putting_it_together": {
        "node_id": "putting_it_together",
        "module_id": "motion_forces",
        "display_name": "Putting It Together",

        "core_concepts": {
            "combined_analysis": "Using multiple concepts together to analyse real scenarios",
            "problem_solving_strategy": "Identify forces → draw FBD → apply Newton's laws → solve",
            "real_world_complexity": "Real problems often involve multiple forces, friction, and constraints",
        },

        "misconception_paths": {},

        "depth_progression": {
            1: {"description": "Qualitative analysis", "language": "Describe what forces act and what happens"},
            2: {"description": "Simple quantitative problems", "language": "One force, one direction"},
            3: {"description": "Multi-force problems", "language": "Inclined planes, pulleys, connected objects"},
            4: {"description": "System analysis", "language": "Multiple interacting objects"},
            5: {"description": "Open-ended problems", "language": "Design, estimate, real engineering"},
        },

        "leads_to_nodes": [
            {"node_id": "real_world_physics", "reason": "Apply everything to real-world challenges.", "estimated_time": 15},
        ],

        "bridges_to_modules": [],
    },

    # ── Node 8: Physics in the Real World ───────────────────────────────
    "real_world_physics": {
        "node_id": "real_world_physics",
        "module_id": "motion_forces",
        "display_name": "Physics in the Real World",

        "core_concepts": {
            "engineering_applications": "Bridges, vehicles, spaceflight all rely on motion & forces",
            "estimation_skills": "Physicists estimate before calculating precisely",
            "experimental_design": "Good experiments isolate variables and control conditions",
        },

        "misconception_paths": {},

        "depth_progression": {
            1: {"description": "Everyday physics spotting", "language": "See physics in daily life"},
            2: {"description": "Estimation and approximation", "language": "Fermi estimates, order of magnitude"},
            3: {"description": "Experimental design", "language": "Hypothesis, variables, controls"},
            4: {"description": "Engineering application", "language": "Design with constraints"},
            5: {"description": "Research frontiers", "language": "Open questions in mechanics"},
        },

        "leads_to_nodes": [],
        "bridges_to_modules": [],
    },
}

# ── Lookup helpers ───────────────────────────────────────────────────────

# Map frontend integer node IDs → knowledge-base keys
NODE_ID_MAP: dict[int, str] = {
    1: "what_is_motion",
    2: "what_is_force",
    3: "speed_velocity",
    4: "types_of_forces",
    5: "understanding_acceleration",
    6: "newtons_laws",
    7: "putting_it_together",
    8: "real_world_physics",
}

# Also accept hyphenated frontend nodeId strings (e.g. "what-is-motion")
NODE_SLUG_MAP: dict[str, str] = {
    "what-is-motion": "what_is_motion",
    "what-is-force": "what_is_force",
    "speed-velocity": "speed_velocity",
    "types-of-forces": "types_of_forces",
    "understanding-acceleration": "understanding_acceleration",
    "newtons-laws": "newtons_laws",
    "putting-it-together": "putting_it_together",
    "real-world-physics": "real_world_physics",
}


def get_node_knowledge(node_id: str | int) -> dict | None:
    """
    Retrieve knowledge for a node by numeric ID, slug, or underscore key.
    Returns None if not found.
    """
    if isinstance(node_id, int):
        key = NODE_ID_MAP.get(node_id)
    elif node_id in MOTION_FORCES_KNOWLEDGE:
        key = node_id
    else:
        key = NODE_SLUG_MAP.get(node_id, node_id.replace("-", "_"))

    return MOTION_FORCES_KNOWLEDGE.get(key)
