"""
Eureka – "What is Motion?"  (v2 – 3Blue1Brown-style)
=====================================================
A 3-minute visual essay that builds curiosity through
dramatic reveals, deliberate pacing, and visual wonder.

Resolution : 1920 × 1080 @ 60 fps
Audio      : none (Azure TTS overlaid at playback)

Scene budget (180 s total):
  1. Opening Question          0:00 → 0:22   (22 s)
  2. Cosmic Zoom-Out           0:22 → 0:55   (33 s)
  3. Reference Frames          0:55 → 1:23   (28 s)
  4. Galileo's Ship            1:23 → 1:50   (27 s)
  5. Everyday Examples         1:50 → 2:35   (45 s)
  6. The Big Reveal            2:35 → 3:00   (25 s)

Render
------
    manim -qh what_is_motion_v2.py WhatIsMotion
"""
# pyright: reportMissingImports=false, reportUndefinedVariable=false

from manim import (
    Scene, VGroup, VMobject,
    Rectangle, RoundedRectangle, Circle, Ellipse, Line, Arrow, DashedLine,
    Polygon, Arc, Dot, Annulus, AnnularSector,
    Text, MathTex,
    ParametricFunction, CurvedArrow,
    FadeIn, FadeOut, Write, Unwrite, Create, Uncreate,
    Indicate, Flash, Circumscribe,
    Rotate, MoveAlongPath, GrowArrow, GrowFromCenter,
    LaggedStart, LaggedStartMap, Succession,
    ReplacementTransform, Transform, AnimationGroup,
    ShrinkToCenter, SpinInFromNothing,
    WHITE, BLUE, BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E,
    RED, RED_A, RED_B, YELLOW, YELLOW_A, YELLOW_B,
    GREEN, GREEN_A, GREEN_B, GREEN_C,
    ORANGE, PURPLE, PURPLE_A,
    GRAY, GRAY_A, GRAY_B, GRAY_C, GRAY_BROWN, DARK_GRAY,
    GOLD, GOLD_A, BLACK,
    UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR,
    PI, TAU, DEGREES,
    ITALIC, BOLD,
    linear, smooth, rate_functions,
    config,
    TracedPath,
)
import numpy as np
np.random.seed(42)


# ═══════════════════════════════════════════════════════════
class WhatIsMotion(Scene):
    """Six scenes, 180 seconds total, 3B1B-style curiosity."""

    # ── palette ───────────────────────────────────────────
    BG       = "#1e1b4b"
    ACCENT   = "#3B82F6"     # Eureka blue
    GOLD_HL  = "#FACC15"     # highlight gold
    SOFT_W   = "#e2e8f0"     # soft white for body text
    DIM      = "#64748b"     # muted text

    def construct(self):
        self.camera.background_color = self.BG

        self.scene_01_opening_question()     # 22 s
        self.scene_02_cosmic_zoom()          # 33 s
        self.scene_03_reference_frames()     # 28 s
        self.scene_04_galileo_ship()         # 27 s
        self.scene_05_everyday()             # 45 s
        self.scene_06_big_reveal()           # 25 s

    # ══════════════════════════════════════════════════════
    # SCENE 1 – The Opening Question  (22 s)
    # ══════════════════════════════════════════════════════
    def scene_01_opening_question(self):
        # --- person sitting with a book ---
        person = self._stick_figure().scale(0.9)
        chair  = self._chair()
        reading = VGroup(chair, person).move_to(ORIGIN).shift(DOWN * 0.5)

        # Fade in gently – give the viewer a moment to settle
        self.play(FadeIn(reading, shift=UP * 0.3), run_time=2)
        self.wait(1)                                                  # 3 s

        # --- the big question ---
        q = Text(
            "Are you moving right now?",
            font_size=54, color=WHITE, weight=BOLD,
        ).to_edge(UP, buff=1)

        self.play(Write(q), run_time=2.5)
        self.wait(2)                                                  # 7.5 s

        # --- thought bubble: "obviously not" ---
        thought = Text(
            '"No… I\'m sitting still."',
            font_size=34, color=GRAY_A, slant=ITALIC,
        )
        bubble = self._thought_bubble(person, thought)
        self.play(FadeIn(bubble, shift=UP * 0.2), run_time=1.5)
        self.wait(2)                                                  # 11 s

        # --- dramatic pause, then the hook ---
        hook = Text(
            "But what if that instinct is misleading?",
            font_size=42, color=self.GOLD_HL,
        ).next_to(q, DOWN, buff=0.6)

        self.play(FadeOut(bubble), run_time=0.8)
        self.wait(0.5)
        self.play(Write(hook), run_time=2)                            # 14.3 s
        self.wait(1.5)

        # --- flash emphasis on question ---
        self.play(
            Indicate(q, color=YELLOW, scale_factor=1.08),
            run_time=1.5,
        )
        self.wait(1)                                                  # 18.3 s

        # --- store refs and clean up slowly ---
        self._reading = reading
        self._q_text  = q
        self._hook    = hook
        self.wait(4.5)  # pad to ~22 s

    # ══════════════════════════════════════════════════════
    # SCENE 2 – Cosmic Zoom-Out  (33 s)
    # ══════════════════════════════════════════════════════
    def scene_02_cosmic_zoom(self):
        # --- clear scene 1 gently ---
        self.play(
            FadeOut(self._q_text),
            FadeOut(self._hook),
            self._reading.animate.scale(0.25).move_to(DOWN * 1.5),
            run_time=2,
        )                                                             # 2 s

        # ── Earth rotating ─────────────────────────────
        earth = Circle(
            radius=2.2, color=BLUE, fill_opacity=0.55,
            stroke_width=3, stroke_color=BLUE_B,
        ).shift(DOWN * 1.5)
        continents = self._make_continents(earth)
        earth_grp = VGroup(earth, continents)

        self.play(
            FadeIn(earth_grp, scale=0.6),
            self._reading.animate.move_to(
                earth.get_center() + UP * 0.5
            ).set_opacity(0.7),
            run_time=2,
        )
        self.wait(0.5)                                                # 4.5 s

        # Speed label – dramatic reveal
        sp1 = self._speed_badge("1,670 km/h", "Earth's Rotation", YELLOW)
        sp1.to_edge(RIGHT, buff=1.2).shift(UP * 2.5)

        self.play(
            Rotate(earth_grp, angle=PI / 3, run_time=3, rate_func=linear),
        )
        self.play(FadeIn(sp1, shift=LEFT * 0.5), run_time=1.5)
        self.play(Indicate(sp1[0], color=YELLOW, scale_factor=1.1), run_time=1)
        self.wait(1.5)                                                # 12 s

        # ── Sun + orbital path ─────────────────────────
        sun = Circle(
            radius=0.6, color=ORANGE, fill_opacity=1,
            stroke_width=2, stroke_color=YELLOW,
        ).shift(LEFT * 3.5 + DOWN * 0.5)
        # Glow effect
        sun_glow = Circle(
            radius=0.9, color=ORANGE, fill_opacity=0.2,
            stroke_width=0,
        ).move_to(sun)
        orbit = Ellipse(
            width=9, height=6.5,
            color=WHITE, stroke_width=1.5, stroke_opacity=0.25,
        ).move_to(sun)

        self.play(
            FadeIn(sun), FadeIn(sun_glow),
            Create(orbit, run_time=2),
            earth_grp.animate.scale(0.25).move_to(
                orbit.point_from_proportion(0.2)
            ),
            self._reading.animate.scale(0.3).set_opacity(0.4),
            run_time=2.5,
        )                                                             # 14.5 s

        sp2 = self._speed_badge("107,000 km/h", "Earth around Sun", GREEN)
        sp2.to_edge(RIGHT, buff=1.2).shift(UP * 0.5)
        self.play(FadeIn(sp2, shift=LEFT * 0.5), run_time=1.5)

        # orbit animation
        self.play(
            MoveAlongPath(earth_grp, orbit, rate_func=linear),
            run_time=4,
        )
        self.wait(0.5)                                                # 20.5 s

        # ── Galaxy ──────────────────────────────────────
        gal_center = Dot(
            point=LEFT * 5 + UP * 2.5,
            radius=0.15, color=PURPLE_A,
        )
        gal_arm = self._galaxy_spiral(gal_center)

        self.play(
            FadeIn(gal_center), FadeIn(gal_arm),
            VGroup(sun, sun_glow, orbit, earth_grp, self._reading)
                .animate.scale(0.15).move_to(LEFT * 3 + UP * 1),
            run_time=2.5,
        )                                                             # 23 s

        sp3 = self._speed_badge("720,000 km/h", "Through the Galaxy", PURPLE_A)
        sp3.to_edge(RIGHT, buff=1.2).shift(DOWN * 2)
        self.play(FadeIn(sp3, shift=LEFT * 0.5), run_time=1.5)
        self.wait(0.5)                                                # 25 s

        # ── subtle visual links between cosmic bodies ───
        link_path = DashedLine(
            earth_grp.get_center(),
            sun.get_center(),
            dash_length=0.2,
            color=WHITE,
            stroke_opacity=0.2,
        )
        gal_link = DashedLine(
            sun.get_center(),
            gal_center.get_center(),
            dash_length=0.2,
            color=WHITE,
            stroke_opacity=0.15,
        )
        self.play(
            Create(link_path),
            Create(gal_link),
            run_time=1.5,
        )
        self.wait(0.5)                                                # 28 s

        # ── Summary beat ───────────────────────────────
        summary = Text(
            'So… are you "sitting still"?',
            font_size=44, color=self.GOLD_HL, weight=BOLD,
        ).to_edge(UP, buff=0.8)
        self.play(Write(summary), run_time=2)
        self.wait(2)                                                  # 30 s

        # ── Clean exit ─────────────────────────────────
        self._speeds = VGroup(sp1, sp2, sp3)
        self._cosmic = VGroup(
            sun, sun_glow, orbit, earth_grp,
            gal_center, gal_arm, self._reading,
            link_path, gal_link,
        )
        self._summary = summary
        self.wait(4)  # pad to ~33 s

    # ══════════════════════════════════════════════════════
    # SCENE 3 – Reference Frames  (28 s)
    # ══════════════════════════════════════════════════════
    def scene_03_reference_frames(self):
        self.play(
            FadeOut(self._cosmic),
            FadeOut(self._speeds),
            FadeOut(self._summary),
            run_time=1.5,
        )                                                             # 1.5 s

        # ── title with emphasis ─────────────────────────
        title = Text(
            "Motion is RELATIVE",
            font_size=56, color=YELLOW, weight=BOLD,
        ).to_edge(UP, buff=0.6)
        self.play(Write(title), run_time=2)
        self.wait(1)                                                  # 4.5 s

        # ── Three reference-frame boxes ─────────────────
        fw, fh = 3.8, 2.4
        f1 = self._ref_box("Ground Observer", fw, fh, LEFT * 4.5 + DOWN * 0.8)
        f2 = self._ref_box("Train Passenger",  fw, fh, DOWN * 0.8)
        f3 = self._ref_box("Bird in Sky",      fw, fh, RIGHT * 4.5 + DOWN * 0.8)

        frames = VGroup(f1, f2, f3)
        self.play(
            LaggedStart(
                *[FadeIn(f, shift=UP * 0.3) for f in frames],
                lag_ratio=0.25,
            ),
            run_time=2.5,
        )
        self.wait(0.5)                                                # 7.5 s

        # ── Add ball and train to each frame ────────────
        # Frame 1: ground perspective
        b1 = Dot(color=RED, radius=0.12).move_to(f1[0].get_center() + LEFT * 1)
        t1 = self._mini_train().move_to(f1[0].get_center() + LEFT * 0.5)

        # Frame 2: train perspective
        b2 = Dot(color=RED, radius=0.12).move_to(f2[0].get_center() + RIGHT * 0.5)
        t2 = self._mini_train().move_to(f2[0].get_center())

        # Frame 3: bird perspective
        b3 = Dot(color=RED, radius=0.12).move_to(f3[0].get_center() + LEFT * 0.5)
        t3 = self._mini_train().move_to(f3[0].get_center() + LEFT * 0.2)

        for mob in [b1, t1, b2, t2, b3, t3]:
            self.play(FadeIn(mob), run_time=0.5)
        self.wait(0.5)                                                # 11 s

        # ── Animate each perspective ────────────────────
        # Ground: train moves right, ball stays
        self.play(t1.animate.shift(RIGHT * 1.5), run_time=2.5, rate_func=linear)
        l1 = Text("Ball: still · Train: moving →", font_size=18, color=GRAY_A)
        l1.next_to(f1, DOWN, buff=0.15)
        self.play(FadeIn(l1), run_time=0.8)
        self.wait(0.5)                                                # 14.8 s

        # Train: ball moves left, train stays
        self.play(b2.animate.shift(LEFT * 1.5), run_time=2.5, rate_func=linear)
        l2 = Text("Ball: moving ← · Train: still", font_size=18, color=GRAY_A)
        l2.next_to(f2, DOWN, buff=0.15)
        self.play(FadeIn(l2), run_time=0.8)
        self.wait(0.5)                                                # 18.6 s

        # Bird: both move
        self.play(
            b3.animate.shift(RIGHT * 0.5),
            t3.animate.shift(RIGHT * 1.2),
            run_time=2.5, rate_func=linear,
        )
        l3 = Text("Ball: moving → · Train: moving →", font_size=18, color=GRAY_A)
        l3.next_to(f3, DOWN, buff=0.15)
        self.play(FadeIn(l3), run_time=0.8)
        self.wait(0.5)                                                # 22.4 s

        # ── Insight ─────────────────────────────────────
        insight = Text(
            "Same event. Three perspectives. All correct.",
            font_size=38, color=self.GOLD_HL,
        ).to_edge(DOWN, buff=0.5)
        self.play(Write(insight), run_time=2.5)
        self.wait(2.5)                                                # ~27 s

        # ── clean up ────────────────────────────────────
        all_s3 = VGroup(
            frames, title, insight,
            b1, b2, b3, t1, t2, t3, l1, l2, l3,
        )
        self.play(FadeOut(all_s3), run_time=1.1)                      # 28 s

    # ══════════════════════════════════════════════════════
    # SCENE 4 – Galileo's Ship  (27 s)
    # ══════════════════════════════════════════════════════
    def scene_04_galileo_ship(self):
        # ── title ───────────────────────────────────────
        title = Text(
            "Galileo's Thought Experiment",
            font_size=48, color=BLUE_B,
        ).to_edge(UP, buff=0.5)
        year = Text("1632", font_size=28, color=self.DIM).next_to(title, DOWN, buff=0.15)
        self.play(Write(title), FadeIn(year), run_time=2)
        self.wait(0.5)                                                # 2.5 s

        # ── ocean ───────────────────────────────────────
        ocean = Rectangle(
            width=15, height=2.2,
            color=BLUE_D, fill_opacity=0.5, stroke_width=0,
        ).to_edge(DOWN, buff=0)
        waves = self._make_waves(ocean)
        self.play(FadeIn(ocean), Create(waves), run_time=1.5)         # 4 s

        # ── ship ────────────────────────────────────────
        hull = Polygon(
            LEFT * 1.8 + DOWN * 0.7,
            RIGHT * 1.8 + DOWN * 0.7,
            RIGHT * 2 + UP * 0,
            LEFT * 2 + UP * 0,
            color="#8B4513", fill_opacity=0.85, stroke_width=2,
            stroke_color="#5C3317",
        )
        deck = Rectangle(
            width=3.8, height=0.25, color="#6B3410", fill_opacity=1,
        ).next_to(hull, UP, buff=0)
        mast = Line(
            deck.get_center(), deck.get_center() + UP * 2.8,
            color="#8B4513", stroke_width=6,
        )
        sail = Polygon(
            mast.get_top(),
            mast.get_top() + RIGHT * 1.6 + DOWN * 1.8,
            mast.get_center() + RIGHT * 0.3,
            color=WHITE, fill_opacity=0.85, stroke_width=2,
        )
        ship = VGroup(hull, deck, mast, sail).shift(LEFT * 4.5 + DOWN * 0.4)
        self.play(FadeIn(ship, shift=RIGHT * 0.5), run_time=1.5)     # 5.5 s

        # ── person on deck + ball ───────────────────────
        person = self._stick_figure(0.35).move_to(
            deck.get_center() + LEFT * 0.5 + UP * 0.55
        )
        ball = Circle(
            radius=0.1, color=RED, fill_opacity=1,
        ).move_to(mast.get_top() + DOWN * 0.2)
        self.play(FadeIn(person), FadeIn(ball), run_time=1)
        self.wait(1)                                                  # 7.5 s

        # ── ship sails, ball drops ──────────────────────
        mast_base_target = mast.get_bottom() + RIGHT * 5 + DOWN * 0.3
        ship_grp = VGroup(ship, person)

        self.play(
            ship_grp.animate.shift(RIGHT * 5),
            ball.animate.move_to(mast_base_target),
            run_time=4, rate_func=linear,
        )
        self.wait(0.5)                                                # 12 s

        # ── highlight landing spot ──────────────────────
        hl = Circle(
            radius=0.3, color=YELLOW, stroke_width=4,
        ).move_to(ball)
        self.play(
            Create(hl),
            Flash(ball, color=YELLOW, flash_radius=0.5),
            run_time=1.5,
        )
        self.wait(1)                                                  # 14.5 s

        # ── insight text ────────────────────────────────
        line1 = Text(
            "The ball lands at the base of the mast.",
            font_size=34, color=WHITE,
        ).to_edge(DOWN, buff=1.8)
        line2 = Text(
            "Not behind it — because it was already",
            font_size=30, color=GRAY_A,
        ).next_to(line1, DOWN, buff=0.15)
        line3 = Text(
            "moving with the ship.",
            font_size=30, color=self.GOLD_HL, weight=BOLD,
        ).next_to(line2, DOWN, buff=0.15)

        self.play(Write(line1), run_time=2)
        self.play(FadeIn(line2), FadeIn(line3), run_time=2)
        self.wait(2.5)                                                # 21 s

        # ── "This changed physics forever" beat ─────────
        changed = Text(
            "And suddenly, motion was no longer absolute.",
            font_size=36, color=BLUE_B,
        ).to_edge(UP, buff=2.5)
        self.play(
            ReplacementTransform(title, changed),
            FadeOut(year),
            run_time=2,
        )
        self.wait(2)                                                  # 25 s

        # ── clean ───────────────────────────────────────
        self.play(
            FadeOut(VGroup(
                ocean, waves, ship_grp, ball, hl,
                line1, line2, line3, changed,
            )),
            run_time=2,
        )
        self.wait(1)                                                  # ~27 s

    # ══════════════════════════════════════════════════════
    # SCENE 5 – Everyday Examples  (45 s)
    # ══════════════════════════════════════════════════════
    def scene_05_everyday(self):
        title = Text(
            "You experience this every day",
            font_size=48, color=GREEN,
        ).to_edge(UP, buff=0.5)
        self.play(Write(title), run_time=2)
        self.wait(0.5)                                                # 2.5 s

        self._ex_airplane(title)   # ~15 s
        self._ex_highway(title)    # ~15 s
        self._ex_moon(title)       # ~12.5 s

        self.play(FadeOut(title), run_time=1)                         # 46 s → trim below

    # ── Example A: Airplane (15 s) ─────────────────────
    def _ex_airplane(self, title):
        # Airplane body
        body = RoundedRectangle(
            width=7, height=1.8, corner_radius=0.4,
            color=GRAY_B, fill_opacity=0.7, stroke_width=2,
        )
        windows = VGroup(*[
            Circle(radius=0.12, color=BLUE_E, fill_opacity=0.6)
            for _ in range(6)
        ]).arrange(RIGHT, buff=0.5).move_to(body)

        nose = Polygon(
            body.get_right(),
            body.get_right() + RIGHT * 1.2 + UP * 0.2,
            body.get_right() + RIGHT * 1.2 + DOWN * 0.2,
            color=GRAY_B, fill_opacity=0.7, stroke_width=2,
        )
        tail = Polygon(
            body.get_left() + UP * 0.9,
            body.get_left() + UP * 0.2,
            body.get_left() + LEFT * 1 + UP * 1.5,
            color=GRAY_B, fill_opacity=0.7, stroke_width=2,
        )
        plane = VGroup(body, windows, nose, tail).shift(DOWN * 0.3)

        person = self._stick_figure(0.35).move_to(
            body.get_center() + LEFT * 2.5
        )
        clouds = VGroup(*[
            self._cloud().shift(RIGHT * i * 3.5 + UP * np.random.uniform(-0.5, 0.5))
            for i in range(4)
        ]).shift(RIGHT * 10)

        self.play(
            FadeIn(plane), FadeIn(person), FadeIn(clouds, shift=LEFT),
            run_time=2,
        )

        lp = Text("You walk: 5 km/h →", font_size=26, color=WHITE)
        lp.next_to(person, DOWN, buff=0.3)
        la = Text("Plane: 900 km/h →", font_size=26, color=YELLOW)
        la.next_to(plane, UP, buff=0.6)
        self.play(FadeIn(lp), FadeIn(la), run_time=1)                # 5.5 s from start

        self.play(
            person.animate.shift(RIGHT * 2.5),
            clouds.animate.shift(LEFT * 8),
            run_time=3.5, rate_func=linear,
        )

        res = Text(
            "Your speed relative to ground: 905 km/h!",
            font_size=34, color=GREEN, weight=BOLD,
        ).to_edge(DOWN, buff=0.6)
        self.play(Write(res), run_time=1.5)
        self.wait(1.2)                                                # ~11.7 s

        self.play(
            FadeOut(VGroup(plane, person, clouds, lp, la, res)),
            run_time=1,
        )
        self.wait(1.5)                                                # 14.2 s

    # ── Example B: Highway (15 s) ──────────────────────
    def _ex_highway(self, title):
        road = Rectangle(
            width=15, height=2.2,
            color="#2d2d2d", fill_opacity=1, stroke_width=0,
        ).to_edge(DOWN, buff=0.8)
        dashes = VGroup(*[
            Rectangle(width=0.9, height=0.12, color=YELLOW, fill_opacity=0.9)
            .shift(LEFT * 6.5 + RIGHT * i * 1.6)
            for i in range(10)
        ]).move_to(road)

        car_you  = self._car(BLUE).move_to(road.get_center() + LEFT * 1)
        car_them = self._car(RED).move_to(road.get_center() + RIGHT * 2)

        trees = VGroup(*[
            self._tree().shift(RIGHT * i * 2.2)
            for i in range(-4, 5)
        ]).shift(UP * 1.5)

        self.play(
            FadeIn(road), Create(dashes),
            FadeIn(car_you), FadeIn(car_them),
            FadeIn(trees),
            run_time=2,
        )

        you_label = Text("You: 100 km/h →", font_size=24, color=BLUE_B)
        you_label.next_to(car_you, UP, buff=0.3)
        them_label = Text("Them: 100 km/h →", font_size=24, color=RED_B)
        them_label.next_to(car_them, UP, buff=0.3)
        self.play(FadeIn(you_label), FadeIn(them_label), run_time=1)  # 5 s

        # Trees fly past, but both cars stay in relative position
        self.play(
            trees.animate.shift(LEFT * 8),
            dashes.animate.shift(LEFT * 8),
            run_time=4, rate_func=linear,
        )

        insight = Text(
            "Other car seems still — same speed as you",
            font_size=32, color=YELLOW,
        ).to_edge(DOWN, buff=0.3)
        self.play(Write(insight), run_time=1.5)
        self.wait(1.2)                                                # ~11.7 s

        self.play(
            FadeOut(VGroup(
                road, dashes, car_you, car_them,
                trees, you_label, them_label, insight,
            )),
            run_time=1,
        )
        self.wait(1.5)                                                # 14.2 s

    # ── Example C: Moon orbit (12.5 s) ─────────────────
    def _ex_moon(self, title):
        earth = Circle(
            radius=1.2, color=BLUE, fill_opacity=0.75,
            stroke_width=2, stroke_color=BLUE_B,
        ).shift(LEFT * 1.5)
        moon = Circle(
            radius=0.3, color=GRAY_B, fill_opacity=1,
        ).shift(LEFT * 1.5 + RIGHT * 3.5)
        orbit_path = Circle(
            radius=3.5, color=WHITE,
            stroke_width=1.5, stroke_opacity=0.3,
        ).move_to(earth)

        self.play(FadeIn(earth), FadeIn(moon), Create(orbit_path), run_time=2)

        # Velocity and gravity arrows
        vel_arrow = Arrow(
            moon.get_center(),
            moon.get_center() + UP * 1.5,
            color=GREEN, buff=0, stroke_width=5,
        )
        vel_label = Text("Velocity", font_size=22, color=GREEN).next_to(vel_arrow, RIGHT, buff=0.15)
        grav_arrow = Arrow(
            moon.get_center(),
            moon.get_center() + LEFT * 1.5,
            color=RED, buff=0, stroke_width=5,
        )
        grav_label = Text("Gravity", font_size=22, color=RED).next_to(grav_arrow, DOWN, buff=0.15)

        self.play(GrowArrow(vel_arrow), Write(vel_label), run_time=1.2)
        self.play(GrowArrow(grav_arrow), Write(grav_label), run_time=1.2)
        self.wait(0.5)                                                # 5 s

        # Beautiful insight
        note = Text(
            "The Moon is constantly falling toward Earth…\n"
            "but moving sideways fast enough to keep missing.",
            font_size=30, color=self.GOLD_HL, line_spacing=1.4,
        ).to_edge(DOWN, buff=0.5)
        self.play(Write(note), run_time=2.5)

        # Rotate moon around earth
        moon_group = VGroup(moon, vel_arrow, vel_label, grav_arrow, grav_label)
        self.play(
            Rotate(
                moon_group, TAU / 3,
                about_point=earth.get_center(),
            ),
            run_time=3.5, rate_func=linear,
        )
        self.wait(1.8)                                                # 12.8 s

        self.play(
            FadeOut(VGroup(
                earth, moon_group, orbit_path, note,
            )),
            run_time=0.5,
        )                                                             # 13.3 s

    # ══════════════════════════════════════════════════════
    # SCENE 6 – The Big Reveal  (25 s)
    # ══════════════════════════════════════════════════════
    def scene_06_big_reveal(self):
        # ── title ───────────────────────────────────────
        title = Text(
            "The Truth About Motion",
            font_size=56, color=YELLOW, weight=BOLD,
        )
        self.play(Write(title), run_time=2.5)
        self.wait(1)
        self.play(
            title.animate.scale(0.65).to_edge(UP, buff=0.6),
            run_time=1.5,
        )                                                             # 5 s

        # ── three insights ──────────────────────────────
        insights = [
            ("1.", "Motion is always RELATIVE", "to a reference frame."),
            ("2.", "There is no universal frame", "of absolute rest."),
            ("3.", 'Even "standing still"', "is a choice of perspective."),
        ]

        insight_grp = VGroup()
        y_offset = 1.5
        for num, main, sub in insights:
            n = Text(num, font_size=36, color=self.GOLD_HL, weight=BOLD)
            m = Text(main, font_size=36, color=WHITE, weight=BOLD)
            s = Text(sub, font_size=28, color=GRAY_A)
            m.next_to(n, RIGHT, buff=0.2)
            s.next_to(VGroup(n, m), DOWN, buff=0.1, aligned_edge=LEFT)
            row = VGroup(n, m, s).move_to(ORIGIN).shift(UP * y_offset)
            y_offset -= 1.8
            insight_grp.add(row)

        for row in insight_grp:
            self.play(FadeIn(row, shift=RIGHT * 0.3), run_time=1.8)
            self.wait(0.8)
        self.wait(1)                                                  # 14.8 s

        # ── emphasis pulse ──────────────────────────────
        self.play(
            Indicate(insight_grp, color=YELLOW, scale_factor=1.03),
            run_time=2,
        )
        self.wait(0.5)                                                # 17.3 s

        # ── Einstein closing ────────────────────────────
        self.play(FadeOut(insight_grp), run_time=1)

        # ── Subtle Vignette Focus Effect ────────────────
        vignette = Annulus(
            inner_radius=3.2,
            outer_radius=7,
            color=BLACK,
            fill_opacity=0.22,
            stroke_width=0,
        ).move_to(ORIGIN)
        self.play(FadeIn(vignette), run_time=1.4)

        final = Text(
            "Einstein would later extend this idea —\n"
            "and build relativity upon it.\n\n"
            "And now you see why.",
            font_size=40, color=BLUE_B, line_spacing=1.5,
        )
        self.play(
            ReplacementTransform(title, final),
            run_time=2.5,
        )
        self.wait(3)                                                  # 23.8 s
        self.play(
            FadeOut(final),
            FadeOut(vignette),
            run_time=1.2,
        )
        self.wait(0.5)                                                # ~25 s

    # ══════════════════════════════════════════════════════
    # PRIMITIVE HELPERS
    # ══════════════════════════════════════════════════════
    def _stick_figure(self, scale=1.0):
        head = Circle(radius=0.2, color=WHITE, fill_opacity=1)
        body = Line(ORIGIN, DOWN * 0.8, color=WHITE, stroke_width=4)
        body.next_to(head, DOWN, buff=0)
        la = Line(body.get_top(), body.get_top() + LEFT * 0.4 + DOWN * 0.3,
                  color=WHITE, stroke_width=4)
        ra = Line(body.get_top(), body.get_top() + RIGHT * 0.4 + DOWN * 0.3,
                  color=WHITE, stroke_width=4)
        ll = Line(body.get_bottom(), body.get_bottom() + LEFT * 0.3 + DOWN * 0.5,
                  color=WHITE, stroke_width=4)
        rl = Line(body.get_bottom(), body.get_bottom() + RIGHT * 0.3 + DOWN * 0.5,
                  color=WHITE, stroke_width=4)
        return VGroup(head, body, la, ra, ll, rl).scale(scale)

    def _chair(self):
        seat = Rectangle(width=0.8, height=0.1, color="#8B4513", fill_opacity=1)
        back = Rectangle(width=0.1, height=0.6, color="#8B4513", fill_opacity=1)
        back.next_to(seat, UP, buff=0).shift(LEFT * 0.35)
        l_leg = Line(seat.get_corner(DL), seat.get_corner(DL) + DOWN * 0.5,
                     color="#8B4513", stroke_width=4)
        r_leg = Line(seat.get_corner(DR), seat.get_corner(DR) + DOWN * 0.5,
                     color="#8B4513", stroke_width=4)
        return VGroup(seat, back, l_leg, r_leg)

    def _thought_bubble(self, person, txt):
        bub = Ellipse(
            width=3.5, height=1.6, color=WHITE,
            fill_opacity=0.9, stroke_width=2,
        )
        bub.next_to(person[0], UP, buff=0.6)
        dot1 = Circle(radius=0.08, color=WHITE, fill_opacity=1).move_to(
            person[0].get_center() + UP * 0.45 + RIGHT * 0.15
        )
        dot2 = Circle(radius=0.12, color=WHITE, fill_opacity=1).move_to(
            person[0].get_center() + UP * 0.65 + RIGHT * 0.25
        )
        txt.move_to(bub)
        return VGroup(bub, dot1, dot2, txt)

    def _speed_badge(self, speed_text, desc_text, color):
        """3B1B-style badge: big number + smaller description."""
        speed = Text(speed_text, font_size=44, color=color, weight=BOLD)
        desc = Text(desc_text, font_size=22, color=self.SOFT_W)
        desc.next_to(speed, DOWN, buff=0.15)
        return VGroup(speed, desc)

    def _make_continents(self, earth):
        """Blob-like land masses on the earth circle."""
        blobs = VGroup()
        for _ in range(4):
            pts = [
                earth.get_center() + np.array([
                    np.random.uniform(-1.5, 1.5),
                    np.random.uniform(-1.5, 1.5),
                    0,
                ])
                for __ in range(5)
            ]
            blob = Polygon(
                *pts, color=GREEN, fill_opacity=0.7, stroke_width=0,
            ).scale(0.3)
            blobs.add(blob)
        return blobs

    def _galaxy_spiral(self, center_dot):
        return ParametricFunction(
            lambda t: center_dot.get_center() + np.array([
                0.5 * t * np.cos(3 * t),
                0.5 * t * np.sin(3 * t),
                0,
            ]),
            t_range=[0, 2 * PI],
            color=PURPLE, stroke_width=3,
        )

    def _ref_box(self, label_text, w, h, pos):
        box = RoundedRectangle(
            width=w, height=h, corner_radius=0.15,
            color=WHITE, stroke_width=2,
        ).move_to(pos)
        label = Text(
            label_text, font_size=18, color=GRAY_A,
        ).next_to(box, UP, buff=0.12)
        return VGroup(box, label)

    def _mini_train(self):
        body = Rectangle(width=0.9, height=0.5, color=BLUE_D, fill_opacity=1)
        w1 = Circle(radius=0.1, color=GRAY, fill_opacity=1).move_to(
            body.get_corner(DL) + RIGHT * 0.2 + UP * 0.1
        )
        w2 = w1.copy().shift(RIGHT * 0.5)
        return VGroup(body, w1, w2)

    def _make_waves(self, ocean):
        waves = VGroup()
        for i in range(8):
            wave = ParametricFunction(
                lambda t, _i=i: np.array([
                    t,
                    0.08 * np.sin(2.5 * t + _i * 0.6),
                    0,
                ]),
                t_range=[-7.5, 7.5],
                color=BLUE_C, stroke_width=1.5,
            ).move_to(ocean.get_top() + DOWN * i * 0.2)
            waves.add(wave)
        return waves

    def _car(self, color):
        body = RoundedRectangle(
            width=1.5, height=0.6, corner_radius=0.1,
            color=color, fill_opacity=1,
        )
        wh1 = Circle(radius=0.13, color=GRAY_BROWN, fill_opacity=1).move_to(
            body.get_corner(DL) + RIGHT * 0.35 + DOWN * 0.05
        )
        wh2 = wh1.copy().shift(RIGHT * 0.8)
        win = Rectangle(
            width=0.5, height=0.25,
            color=BLUE_E, fill_opacity=0.8,
        ).move_to(body.get_center() + UP * 0.08)
        return VGroup(body, wh1, wh2, win)

    def _cloud(self):
        return VGroup(
            Circle(radius=0.25, color=WHITE, fill_opacity=0.85),
            Circle(radius=0.3, color=WHITE, fill_opacity=0.85).shift(RIGHT * 0.35),
            Circle(radius=0.25, color=WHITE, fill_opacity=0.85).shift(RIGHT * 0.7),
            Circle(radius=0.2, color=WHITE, fill_opacity=0.85).shift(UP * 0.18 + RIGHT * 0.35),
        )

    def _tree(self):
        trunk = Rectangle(width=0.08, height=0.4, color="#8B4513", fill_opacity=1)
        leaves = Circle(radius=0.25, color=GREEN, fill_opacity=0.9).next_to(trunk, UP, buff=0)
        return VGroup(trunk, leaves).scale(0.6)
