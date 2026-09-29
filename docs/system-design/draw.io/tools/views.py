#!/usr/bin/env python3
"""The seven supervisor views, drawn once and written to both tools.

    python3 views.py                 # the .drawio files and their PNGs
    python3 views.py --vpspec OUT    # the same views as Visual Paradigm build records

The supervisor asked for five kinds of diagram, in draw.io and Visual Paradigm:

    1 business context   2 functional architecture   3 use case
    4 data flow, levels 0, 1 and 2   5 system architecture

Unlike the other diagrams in this folder, these are not converted from Mermaid: Mermaid has
no hub-and-spoke context view, no layered architecture and no DFD notation (round processes,
open-ended data stores). So each view is laid out here by hand, in coordinates, and the same
data feeds both tools. Visual Paradigm draws them at exactly these positions
(see ../../visual-paradigm/tools/build_spec.py).

Every flow in a data flow diagram names the data it carries, never the mechanism, and a pair
of shapes that exchange data both ways gets two arrows, one per direction.
"""
import html
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
DRAWIO = HERE.parent


# ── the model ─────────────────────────────────────────────────────────────────

@dataclass
class Node:
    id: str
    role: str
    x: int
    y: int
    w: int
    h: int
    text: str
    parent: str = ''
    number: str = ''          # a DFD process's number, or a data store's "D1"


@dataclass
class Edge:
    src: str
    dst: str
    label: str = ''
    kind: str = 'flow'        # flow | both | association | include | extend | generalization | uses
    via: tuple = ()           # bend points, absolute
    at: float = 0.0           # where the label sits along the line, -1 (start) to 1 (end)


@dataclass
class View:
    folder: str
    stem: str
    title: str
    vp: str                   # Visual Paradigm diagram kind: dfd | component | usecase
    width: int
    height: int
    nodes: list
    edges: list
    caption: str = ''


# ── colours ──────────────────────────────────────────────────────────────────

INK = '#2f3a45'           # the dark boxes, and every outline
SLATE = '#4a5563'
MUTED = '#5b6470'
LINE = '#56616d'
NUMBER = '#f5b041'        # a process number, as in the reference
BAND = '#eef1f4'

STYLE = {
    # business context
    'hub': f'rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor={INK};strokeColor=none;fontColor=#ffffff;fontSize=17;fontStyle=1;',
    'party': f'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor={SLATE};strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    # layered architecture
    'band': f'rounded=0;whiteSpace=wrap;html=1;fillColor={BAND};strokeColor=none;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontStyle=1;fontColor={MUTED};',
    'channel': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#3d5a80;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'gateway': 'rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor=#e67e22;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'module': f'rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor={SLATE};strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'crosscut': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#5d6b58;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'datastore': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#4f8a4c;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    # system architecture
    'zone-client': 'rounded=1;arcSize=2;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 5;fillColor=none;strokeColor=#8a939c;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontStyle=1;fontColor=#5b6470;',
    'zone-edge': 'rounded=1;arcSize=2;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 5;fillColor=none;strokeColor=#c0392b;strokeWidth=2;verticalAlign=bottom;align=left;spacingLeft=12;spacingBottom=2;fontSize=12;fontStyle=1;fontColor=#c0392b;',
    'zone-app': f'rounded=1;arcSize=2;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 5;fillColor=none;strokeColor={INK};strokeWidth=2;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontStyle=1;fontColor={INK};',
    'zone-data': 'rounded=1;arcSize=2;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 5;fillColor=none;strokeColor=#3949ab;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontStyle=1;fontColor=#3949ab;',
    'zone-platform': 'rounded=1;arcSize=2;whiteSpace=wrap;html=1;dashed=1;dashPattern=8 5;fillColor=none;strokeColor=#37474f;strokeWidth=2;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;fontSize=12;fontStyle=1;fontColor=#37474f;',
    'client': f'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor={SLATE};strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'edge': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#c0392b;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'service': f'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor={INK};strokeWidth=2;fontColor={INK};fontSize=13;fontStyle=1;',
    'bar': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#9c6b30;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'data': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#3949ab;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'platform': 'rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#37474f;strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    # use case
    'boundary': f'rounded=0;whiteSpace=wrap;html=1;fillColor=#f7f8fa;strokeColor={INK};strokeWidth=2;verticalAlign=top;fontSize=16;fontStyle=1;spacingTop=10;fontColor={INK};',
    'actor': f'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#ffffff;strokeColor={INK};strokeWidth=2;fontSize=14;fontStyle=1;fontColor={INK};',
    'usecase': f'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor={INK};strokeWidth=1.5;fontSize=13;fontColor={INK};',
    # data flow
    'process': f'ellipse;whiteSpace=wrap;html=1;fillColor={INK};strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'other': f'ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor={INK};strokeWidth=2;dashed=1;dashPattern=6 4;fontColor={INK};fontSize=13;fontStyle=1;',
    'entity': f'rounded=0;whiteSpace=wrap;html=1;fillColor={INK};strokeColor=none;fontColor=#ffffff;fontSize=13;fontStyle=1;',
    'store': f'shape=partialRectangle;whiteSpace=wrap;html=1;left=1;right=0;top=1;bottom=1;fillColor=#ffffff;strokeColor={INK};strokeWidth=2;align=left;spacingLeft=62;fontSize=13;fontColor={INK};',
}
ROUND = {'process', 'other', 'usecase'}

# What each role is in Visual Paradigm, and its colours there (fill, text).
VP_SHAPE = {
    'hub': ('DFProcess', INK, '#ffffff'),
    'party': ('DFProcess', SLATE, '#ffffff'),
    'band': ('Package', BAND, ''),
    'channel': ('Component', '#3d5a80', '#ffffff'),
    'gateway': ('Component', '#e67e22', '#ffffff'),
    'module': ('Component', SLATE, '#ffffff'),
    'crosscut': ('Component', '#5d6b58', '#ffffff'),
    'datastore': ('Component', '#4f8a4c', '#ffffff'),
    'zone-client': ('Package', '#f4f5f7', ''),
    'zone-edge': ('Package', '#fbeae8', ''),
    'zone-app': ('Package', '#f4f5f7', ''),
    'zone-data': ('Package', '#eceefa', ''),
    'zone-platform': ('Package', '#eef0f1', ''),
    'client': ('Component', SLATE, '#ffffff'),
    'edge': ('Component', '#c0392b', '#ffffff'),
    'service': ('Component', '#ffffff', INK),
    'bar': ('Component', '#9c6b30', '#ffffff'),
    'data': ('Component', '#3949ab', '#ffffff'),
    'platform': ('Component', '#37474f', '#ffffff'),
    'boundary': ('System', '', ''),
    'actor': ('Actor', '', ''),
    'usecase': ('UseCase', '', ''),
    'process': ('DFStartCircle', INK, '#ffffff'),
    'other': ('DFStartCircle', '#ffffff', INK),
    'entity': ('DFProcess', INK, '#ffffff'),
    'store': ('DFDataStore', '#ffffff', INK),
}
VP_LINK = {'flow': 'DataFlow', 'both': 'DataFlow', 'association': 'Association', 'include': 'Include',
           'extend': 'Extend', 'generalization': 'Generalization', 'uses': 'Dependency'}


# ── 1 · business context ─────────────────────────────────────────────────────

def business_context():
    W, H = 300, 104
    n = [
        Node('hub', 'hub', 560, 440, 380, 140, 'EkSamadhan AI\nCustomer Support Platform'),
        Node('customers', 'party', 60, 60, W, H, 'Customers\n(people messaging the business on Facebook and Instagram)'),
        Node('owners', 'party', 600, 40, W, H, 'Business owner and admins\n(Tenant, Admin)'),
        Node('staff', 'party', 1140, 60, W, H, 'Support staff\n(internal team members)'),
        Node('meta', 'party', 40, 458, W, H, 'Meta\n(Facebook and Instagram messaging)'),
        Node('ai', 'party', 1160, 458, W, H, 'AI model providers\n(language, search and decision models)'),
        Node('google', 'party', 60, 860, W, H, 'Google\n(sign-in identity)'),
        Node('operator', 'party', 600, 880, W, H, 'Platform operator\n(system admin)'),
        Node('delivery', 'party', 1140, 860, W, H, 'Email and push services\n(staff alerts)'),
    ]
    e = [
        Edge('customers', 'hub', 'Ask questions, any hour / get answers'),
        Edge('owners', 'hub', 'Set up knowledge and team / see results'),
        Edge('staff', 'hub', 'Take over, reply, resolve'),
        Edge('meta', 'hub', 'Deliver messages and replies'),
        Edge('hub', 'ai', 'Understand, answer, judge'),
        Edge('google', 'hub', 'Confirm who is signing in'),
        Edge('operator', 'hub', 'Check how the AI decided'),
        Edge('hub', 'delivery', 'Alert staff to a handover'),
    ]
    return View('business-context', 'business-context-diagram', 'Business context diagram', 'dfd',
                1500, 1040, n, e,
                'Scope: who the platform exchanges value with, and why. No internal design, no technology.')


# ── 2 · functional architecture ──────────────────────────────────────────────

def functional_architecture():
    n = [Node('l1', 'band', 20, 20, 1560, 130, 'CHANNEL LAYER'),
         Node('l2', 'band', 20, 170, 1560, 110, 'EXPERIENCE / API LAYER'),
         Node('l3', 'band', 20, 300, 1560, 200, 'CORE FUNCTIONAL MODULES'),
         Node('l4', 'band', 20, 520, 1560, 110, 'CROSS-CUTTING SERVICES'),
         Node('l5', 'band', 20, 650, 1560, 120, 'DATA AND INTEGRATION LAYER')]
    for i, t in enumerate(['Facebook Messenger', 'Instagram Direct',
                           'Staff dashboard\n(web and installable app)', 'System admin console']):
        n.append(Node(f'c{i}', 'channel', 40 + i * 390, 55, 350, 70, t, 'l1'))
    n.append(Node('api', 'gateway', 200, 205, 1200, 60,
                  'API: REST, Meta webhook, live events · sign-in, roles, workspace scoping, rate limits', 'l2'))
    mods = ['Conversation inbox', 'Message triage\n(Jev firewall)', 'AI answering\n(from the knowledge base)',
            'Escalation and routing\n(availability, working hours)', 'Notifications\n(push, email, bell)',
            'Knowledge management', 'Team and workspace', 'Analytics']
    for i, t in enumerate(mods):
        n.append(Node(f'm{i}', 'module', 40 + i * 192, 340, 175, 140, t, 'l3'))
    for i, t in enumerate(['Identity and access\n(password, Google sign-in, roles)',
                           'AI trace and audit\n(every step recorded)',
                           'Privacy and account lifecycle\n(export, deactivate, delete)']):
        n.append(Node(f'x{i}', 'crosscut', 40 + i * 515, 555, 490, 55, t, 'l4'))
    for i, t in enumerate(['Conversation and workspace data\n(PostgreSQL)', 'Knowledge embeddings\n(pgvector)',
                           'Meta integration\n(Graph API)', 'AI model integration\n(chat, embeddings, Jev)',
                           'Delivery integration\n(email, Web Push)']):
        n.append(Node(f'd{i}', 'datastore', 40 + i * 305, 690, 290, 60, t, 'l5'))
    e = [Edge(f'c{i}', 'api', kind='uses') for i in range(4)]
    e += [Edge('api', 'm4', kind='uses'), Edge('m4', 'x1', kind='uses'), Edge('x1', 'd2', kind='uses')]
    return View('functional-architecture', 'functional-architecture-diagram', 'Functional architecture diagram',
                'component', 1600, 830, n, e,
                'Five layers: channels, API, core modules, cross-cutting services, data and integration.')


# ── 3 · use case ─────────────────────────────────────────────────────────────

def use_case():
    n = [Node('sys', 'boundary', 220, 40, 1240, 1460, 'EkSamadhan AI platform')]
    col1 = ['Sign in with a password or Google', 'Install the app on this device', 'View the unified inbox',
            'Reply with text, a photo or a voice note', 'Take over a conversation',
            'Transfer, hand back or resolve', 'Pin a conversation to the top',
            'Set availability and working hours', 'Receive and clear alerts',
            'Leave the workspace\n(export, deactivate, delete)',
            'Connect a Facebook or Instagram page', 'Add business knowledge\n(text, PDF, image, website)',
            'Invite team members', 'Configure the workspace and AI replies', 'View analytics',
            "Inspect a message's AI flow, step by step"]
    Y = lambda i: 100 + i * 84
    for i, t in enumerate(col1):
        n.append(Node(f'u{i}', 'usecase', 260, Y(i), 330, 64, t, 'sys'))
    right = {'c1': (100, 'Send a message'), 'c2': (184, 'Receive an answer'),
             'd1': (352, 'Triage a message\n(Jev)'), 'd2': (520, 'Answer from the knowledge base'),
             'd3': (688, 'Hand over to a person'), 'd4': (856, 'Transcribe a voice note\nor read a photo')}
    for k, (y, t) in right.items():
        n.append(Node(k, 'usecase', 1080, y, 330, 64, t, 'sys'))
    mid = {'m1': (300, 'Flag a spam conversation'), 'm2': (400, 'Set the priority, 1 to 3'),
           'm3': (640, 'Route to an available staff member'), 'm4': (740, 'Write the handover brief')}
    for k, (y, t) in mid.items():
        n.append(Node(k, 'usecase', 680, y, 300, 64, t, 'sys'))
    n += [Node('staff', 'actor', 95, 450, 50, 100, 'Staff\n(support agent)'),
          Node('admin', 'actor', 95, 1080, 50, 100, 'Tenant / Admin'),
          Node('sysadmin', 'actor', 95, 1340, 50, 100, 'System admin'),
          Node('customer', 'actor', 1555, 90, 50, 100, 'Customer'),
          Node('meta', 'actor', 1555, 300, 50, 100, 'Meta\n(external system)'),
          Node('ai', 'actor', 1555, 570, 50, 100, 'AI system')]
    e = [Edge('staff', f'u{i}', kind='association') for i in range(10)]
    e += [Edge('admin', f'u{i}', kind='association') for i in range(10, 15)]
    e += [Edge('sysadmin', 'u15', kind='association')]
    e += [Edge('admin', 'staff', kind='generalization', via=((50, 1130), (50, 500)))]
    e += [Edge('customer', 'c1', kind='association'), Edge('customer', 'c2', kind='association'),
          Edge('meta', 'c1', kind='association'), Edge('meta', 'c2', kind='association')]
    e += [Edge('ai', k, kind='association') for k in ('d1', 'd2', 'd3', 'd4')]
    e += [Edge('d1', 'm1', '«include»', kind='include'), Edge('d1', 'm2', '«include»', kind='include'),
          Edge('d3', 'm3', '«include»', kind='include'), Edge('d3', 'm4', '«include»', kind='include'),
          Edge('d3', 'd2', '«extend» cannot answer', kind='extend')]
    return View('use-case', 'use-case-diagram', 'Use case diagram', 'usecase', 1660, 1540, n, e,
                'Tenant and Admin can do everything Staff can (the hollow arrow), plus run the workspace.')


# ── 4 · data flow ────────────────────────────────────────────────────────────

def P(id, cx, cy, number, text, d=150, role='process'):
    return Node(id, role, cx - d // 2, cy - d // 2, d, d, text, number=number)


def S(id, x, y, number, text, w=300, h=48):
    return Node(id, 'store', x, y, w, h, text, number=number)


def dfd_level0():
    n = [P('sys', 750, 480, '0', 'EkSamadhan AI\nsupport system', d=250),
         Node('customer', 'entity', 60, 70, 250, 80, 'Customer'),
         Node('meta', 'entity', 60, 440, 250, 80, 'Meta platform\n(Facebook, Instagram)'),
         Node('google', 'entity', 60, 820, 250, 80, 'Google\n(sign-in)'),
         Node('ai', 'entity', 625, 40, 250, 80, 'AI model services'),
         Node('admin', 'entity', 1190, 70, 250, 80, 'Tenant / Admin'),
         Node('staff', 'entity', 1190, 440, 250, 80, 'Staff\n(support agent)'),
         Node('sysadmin', 'entity', 1190, 820, 250, 80, 'System admin')]
    e = [Edge('customer', 'meta', 'Question, voice note, photo / Delivered answer', kind='both'),
         Edge('meta', 'sys', 'Inbound message / Reply to deliver', kind='both'),
         Edge('google', 'sys', 'Signed sign-in token'),
         Edge('sys', 'ai', 'Message and knowledge text / Embeddings, judgments, draft answers', kind='both'),
         Edge('admin', 'sys', 'Knowledge, settings, invitations / Analytics', kind='both'),
         Edge('staff', 'sys', 'Replies and actions / Inbox, handover brief, alerts', kind='both'),
         Edge('sysadmin', 'sys', 'Chosen message / AI flow, step by step', kind='both')]
    return View('data-flow-diagram', 'level-0-data-flow-diagram', 'Data flow diagram - level 0', 'dfd',
                1500, 960, n, e, 'One process, seven external entities: what crosses the boundary, and nothing inside it.')


def dfd_level1():
    n = [Node('customer', 'entity', 60, 50, 230, 76, 'Customer'),
         Node('meta', 'entity', 60, 260, 230, 80, 'Meta platform'),
         Node('ai', 'entity', 620, 20, 1020, 70, 'AI model services'),
         Node('admin', 'entity', 1780, 260, 200, 80, 'Tenant / Admin'),
         Node('admin2', 'entity', 1760, 1000, 220, 80, 'Tenant / Admin'),
         Node('sysadmin', 'entity', 1760, 640, 220, 80, 'System admin'),
         Node('google', 'entity', 1760, 1170, 220, 76, 'Google\n(sign-in)'),
         Node('staff', 'entity', 330, 1080, 250, 80, 'Staff\n(support agent)'),
         P('p1', 480, 300, '1.0', 'Receive and\nsend messages'),
         P('p2', 820, 300, '2.0', 'Triage the\nmessage'),
         P('p3', 1200, 300, '3.0', 'Answer with AI'),
         P('p7', 1540, 300, '7.0', 'Manage\nknowledge'),
         P('p5', 480, 820, '5.0', 'Handle staff\nactions'),
         P('p4', 1100, 820, '4.0', 'Hand over\nto staff'),
         P('p8', 1600, 820, '8.0', 'Report and\ntrace'),
         P('p6', 1450, 1080, '6.0', 'Manage\nworkspace\nand team'),
         S('d3', 870, 168, 'D3', 'Triage and AI trace', w=230, h=42),
         S('d2', 1250, 450, 'D2', 'Knowledge base', w=280),
         S('d1', 620, 560, 'D1', 'Conversations and messages'),
         S('d5', 60, 520, 'D5', 'Media files', w=240),
         S('d1b', 1230, 690, 'D1', 'Conversations and messages'),
         S('d3b', 1230, 900, 'D3', 'Triage and AI trace', w=270),
         S('d4', 900, 1000, 'D4', 'Workspace, people, hours')]
    e = [Edge('customer', 'meta', 'Question / Answer', kind='both'),
         Edge('meta', 'p1', 'Inbound message / Reply to deliver', kind='both'),
         Edge('p1', 'd5', 'Attachments'),
         Edge('p1', 'd1', 'Message, thread'),
         Edge('p1', 'p2', 'New message'),
         Edge('p2', 'ai', 'Message text / Triage judgments', kind='both', at=0.62),
         Edge('p2', 'd3', 'Triage record'),
         Edge('p2', 'p3', 'Message and verdict'),
         Edge('p3', 'ai', 'Prompt / Draft answer', kind='both', at=0.62),
         Edge('p3', 'd3', 'Each step'),
         Edge('d2', 'p3', 'Matching passages'),
         Edge('d1', 'p3', 'Earlier messages'),
         Edge('p3', 'p1', 'Answer or handover notice', via=((820, 450),)),
         Edge('p3', 'p4', 'Cannot answer, or asks for a person'),
         Edge('d4', 'p4', 'Who is available now'),
         Edge('p4', 'd1', 'Assignee, status'),
         Edge('p4', 'staff', 'Alert: push, email, bell'),
         Edge('staff', 'p5', 'Reply, take over, resolve / Inbox, handover brief', kind='both'),
         Edge('p5', 'd1', 'Status changes / Conversations', kind='both'),
         Edge('p5', 'p1', 'Staff reply to send'),
         Edge('admin2', 'p6', 'Settings, invitations, page'),
         Edge('staff', 'p6', 'Availability, working hours', via=((455, 1220), (1450, 1220))),
         Edge('google', 'p6', 'Signed sign-in token'),
         Edge('p6', 'd4', 'Workspace, people, hours'),
         Edge('admin', 'p7', 'Text, PDF, image, website'),
         Edge('p7', 'ai', 'Passage text / Embeddings', kind='both', at=0.62),
         Edge('p7', 'd2', 'Passages and vectors'),
         Edge('d1b', 'p8', 'Messages, reply times'),
         Edge('d3b', 'p8', 'Trace steps'),
         Edge('p8', 'admin2', 'Analytics'),
         Edge('sysadmin', 'p8', 'Chosen message / AI flow, step by step', kind='both')]
    return View('data-flow-diagram', 'level-1-data-flow-diagram', 'Data flow diagram - level 1', 'dfd',
                2000, 1300, n, e,
                'Eight processes, five data stores, seven external entities. Tenant / Admin, D1 and D3 are drawn twice to keep lines apart.')


def dfd_level2():
    n = [P('p2', 150, 300, '2.0', 'Triage the\nmessage', role='other'),
         P('p1', 2060, 300, '1.0', 'Receive and\nsend messages', role='other'),
         P('p4', 1420, 700, '4.0', 'Hand over\nto staff', role='other'),
         Node('ai', 'entity', 690, 30, 480, 70, 'AI model services'),
         P('q1', 430, 300, '3.1', 'Check the\ngates'),
         P('q2', 760, 300, '3.2', 'Find matching\nknowledge'),
         P('q3', 760, 760, '3.3', 'Recall the\nconversation'),
         P('q4', 1100, 300, '3.4', 'Write the\nanswer'),
         P('q5', 1420, 300, '3.5', 'Judge the\nanswer'),
         P('q6', 1740, 300, '3.6', 'Send and\nrecord'),
         S('d4', 290, 120, 'D4', 'Workspace, people, hours', w=290),
         S('d1', 280, 520, 'D1', 'Conversations and messages'),
         S('d2', 600, 520, 'D2', 'Knowledge base', w=230),
         S('d1b', 1600, 700, 'D1', 'Conversations and messages'),
         S('d3', 1880, 520, 'D3', 'Triage and AI trace', w=260)]
    e = [Edge('p2', 'q1', 'Message and verdict'),
         Edge('d4', 'q1', 'AI replies on or off'),
         Edge('d1', 'q1', 'Recent messages'),
         Edge('q1', 'q2', 'Question'),
         Edge('q1', 'p4', 'Hand over now: AI off, asks for a person, keeps repeating',
              via=((240, 440), (240, 960), (1420, 960))),
         Edge('q2', 'ai', 'Question / Embedding', kind='both', at=0.55),
         Edge('d2', 'q2', 'Passages, similarity'),
         Edge('q2', 'q4', 'Best passages'),
         Edge('d1', 'q3', 'Earlier messages'),
         Edge('q3', 'q4', 'Conversation memory'),
         Edge('q4', 'ai', 'Prompt / Draft answer, confidence', kind='both', at=0.55),
         Edge('q4', 'q5', 'Draft, confidence'),
         Edge('q5', 'q6', 'Answer, or handover'),
         Edge('q5', 'p4', 'Cannot answer'),
         Edge('q5', 'd1b', 'Off-topic count'),
         Edge('q6', 'p1', 'Answer or handover notice'),
         Edge('q6', 'd1b', 'Reply, sources, timings'),
         Edge('q6', 'd3', 'Each step')]
    return View('data-flow-diagram', 'level-2-data-flow-diagram-answer-with-ai',
                'Data flow diagram - level 2, Answer with AI', 'dfd', 2180, 1060, n, e,
                'Process 3.0 opened up. Dashed circles are the level 1 processes it trades data with; D1 is drawn twice.')


# ── 5 · system architecture ──────────────────────────────────────────────────

def system_architecture():
    n = [Node('z1', 'zone-client', 20, 20, 1660, 140, 'CLIENT TIER'),
         Node('z2', 'zone-edge', 20, 180, 1660, 130, 'EDGE / INGRESS ZONE (DEVELOPMENT)'),
         Node('z3', 'zone-app', 20, 330, 1660, 320, 'APPLICATION ZONE (SPRING BOOT 4, JAVA 21)'),
         Node('z4', 'zone-data', 20, 670, 810, 230, 'DATA ZONE'),
         Node('z5', 'zone-platform', 850, 670, 830, 230, 'PLATFORM AND EXTERNAL SERVICES'),
         Node('fb', 'client', 40, 60, 300, 70, 'Customer on\nFacebook Messenger', 'z1'),
         Node('ig', 'client', 360, 60, 300, 70, 'Customer on\nInstagram Direct', 'z1'),
         Node('dash', 'client', 1000, 60, 320, 70, 'Staff dashboard\n(React, installable app)', 'z1'),
         Node('console', 'client', 1340, 60, 320, 70, 'System admin console\n(conversation visualizer)', 'z1'),
         Node('meta', 'edge', 40, 220, 300, 70, 'Meta Graph API\nwebhooks, send API', 'z2'),
         Node('proxy', 'edge', 380, 220, 300, 70, 'meta-proxy on Vercel\nthe fixed URL Meta calls', 'z2'),
         Node('tunnel', 'edge', 720, 220, 240, 70, 'Pinggy tunnel\nand Upstash Redis', 'z2'),
         Node('api', 'bar', 40, 370, 1620, 55,
              'API and security: REST controllers, webhook signature check, JWT, roles, rate limits, live events (SSE)', 'z3')]
    svc = ['Channel\n(Meta, sync)', 'Conversation\nand routing', 'Message triage\n(Jev firewall)',
           'AI reply\n(retrieval, answer)', 'Knowledge\ningestion', 'Notifications\n(push, email)',
           'Analytics and\nAI trace']
    for i, t in enumerate(svc):
        n.append(Node(f's{i}', 'service', 40 + i * 232, 450, 215, 90, t, 'z3'))
    n += [Node('pipe', 'bar', 40, 565, 790, 55, 'After-commit reply pool · JPA and JDBC data access', 'z3'),
          Node('out', 'bar', 870, 565, 790, 55, 'Outbound clients: models, email, push, Google keys', 'z3'),
          Node('pg', 'data', 40, 715, 370, 70, 'PostgreSQL 16\nconversations, people, triage, traces', 'z4'),
          Node('vec', 'data', 430, 715, 380, 70, 'pgvector (same database)\nknowledge and message embeddings', 'z4'),
          Node('media', 'data', 40, 805, 370, 70, 'Media files\nlocal disk', 'z4'),
          Node('flyway', 'data', 430, 805, 380, 70, 'Flyway migrations\nV1 to V31', 'z4'),
          Node('ollama', 'platform', 870, 715, 255, 70, 'Ollama, Gemma 4\nlocal chat model', 'z5'),
          Node('openrouter', 'platform', 1140, 715, 255, 70, 'OpenRouter\nembeddings', 'z5'),
          Node('jev', 'platform', 1410, 715, 250, 70, 'TypeSafe Jev\ndecision model', 'z5'),
          Node('resend', 'platform', 870, 805, 255, 70, 'Resend\nemail', 'z5'),
          Node('push', 'platform', 1140, 805, 255, 70, 'Browser push services\nWeb Push', 'z5'),
          Node('firebase', 'platform', 1410, 805, 250, 70, 'Google Firebase\nAuthentication', 'z5')]
    e = [Edge('fb', 'meta', kind='uses'), Edge('ig', 'meta', kind='uses'),
         Edge('meta', 'proxy', kind='uses'), Edge('proxy', 'tunnel', kind='uses'),
         Edge('tunnel', 'api', kind='uses'),
         Edge('dash', 'api', kind='uses'), Edge('console', 'api', kind='uses'),
         Edge('pipe', 'pg', kind='uses'), Edge('out', 'openrouter', kind='uses')]
    return View('system-architecture', 'system-architecture-diagram', 'System architecture diagram', 'component',
                1700, 960, n, e, 'Five zones: clients, edge, application, data, platform and external services.')


VIEWS = [business_context, functional_architecture, use_case, dfd_level0, dfd_level1, dfd_level2,
         system_architecture]


# ── geometry ─────────────────────────────────────────────────────────────────

def centre(n):
    return n.x + n.w / 2, n.y + n.h / 2


def border(n, fx, fy, tx, ty):
    """Where the ray from (fx, fy), inside n, towards (tx, ty) leaves n."""
    dx, dy = tx - fx, ty - fy
    if dx == 0 and dy == 0:
        return fx, fy
    if n.role in ROUND:
        a, b = n.w / 2, n.h / 2
        cx, cy = centre(n)
        ox, oy = fx - cx, fy - cy
        A = (dx / a) ** 2 + (dy / b) ** 2
        B = 2 * (ox * dx / a ** 2 + oy * dy / b ** 2)
        C = (ox / a) ** 2 + (oy / b) ** 2 - 1
        t = (-B + math.sqrt(max(0, B * B - 4 * A * C))) / (2 * A)
    else:
        ts = []
        if dx > 0: ts.append((n.x + n.w - fx) / dx)
        if dx < 0: ts.append((n.x - fx) / dx)
        if dy > 0: ts.append((n.y + n.h - fy) / dy)
        if dy < 0: ts.append((n.y - fy) / dy)
        t = min(ts)
    return fx + dx * t, fy + dy * t


def paths(view):
    """Each edge as (edge, points, label, label position): a two-way flow becomes two arrows."""
    by = {n.id: n for n in view.nodes}
    out = []
    for e in view.edges:
        a, b = by[e.src], by[e.dst]
        ends = [(e.src, e.dst, e.label, 0)] if e.kind != 'both' else [
            (e.src, e.dst, e.label.split(' / ')[0], -13), (e.dst, e.src, e.label.split(' / ')[-1], 13)]
        for s, d, label, off in ends:
            sn, dn = by[s], by[d]
            via = list(e.via) if s == e.src else list(reversed(e.via))
            (sx, sy), (dx, dy) = centre(sn), centre(dn)
            # Layered views: one shape straight above, below or beside the other gets a straight
            # arrow, not one from centre to centre.
            if e.kind in ('uses', 'both') and not via and 'entity' in (sn.role, dn.role) or (e.kind == 'uses' and not via):
                # Lined up on the narrower shape's centre, so the arrow meets it square on.
                if sn.w <= dn.w and dn.x <= sx <= dn.x + dn.w:
                    dx = sx
                elif sn.x <= dx <= sn.x + sn.w:
                    sx = dx
                elif dn.x <= sx <= dn.x + dn.w:
                    dx = sx
                elif dn.y <= sy <= dn.y + dn.h:
                    dy = sy
                elif sn.y <= dy <= sn.y + sn.h:
                    sy = dy
            first = via[0] if via else (dx, dy)
            last = via[-1] if via else (sx, sy)
            # Two arrows between the same pair run side by side, 26px apart.
            px, py = 0.0, 0.0
            if off:
                ux, uy = (first[0] - sx), (first[1] - sy)
                L = math.hypot(ux, uy) or 1
                px, py = -uy / L * off, ux / L * off
                if s != e.src:
                    px, py = -px, -py
            start = border(sn, sx + px, sy + py, first[0] + px, first[1] + py)
            end = border(dn, dx + px, dy + py, last[0] + px, last[1] + py)
            # An actor's line meets a use case at the oval's near tip, so a fan of lines stays
            # in the gap between the actor and the column, instead of cutting through ovals.
            if e.kind == 'association' and not via:
                actor, case = (sn, dn) if sn.role == 'actor' else (dn, sn)
                tip = (case.x if centre(actor)[0] < case.x else case.x + case.w, centre(case)[1])
                # From the actor's side at shoulder height: clear of the name printed below it.
                ax, ay = centre(actor)
                at_actor = (actor.x + actor.w if tip[0] > ax else actor.x, actor.y + actor.h * 0.35)
                start, end = (at_actor, tip) if sn is actor else (tip, at_actor)
            pts = [start] + [(x + px, y + py) for x, y in via] + [end]
            at = e.at if s == e.src else -e.at
            shift = (0, 0)
            if off:
                # Beside its own arrow, on the outside of the pair, clear of the other label.
                L = math.hypot(px, py) or 1
                ux, uy = px / L, py / L
                half = len(label) * 3.4
                gap = abs(ux) * half + abs(uy) * 9 + 6
                shift = (round(ux * gap), round(uy * gap))
            out.append((e, s, d, [(round(x), round(y)) for x, y in pts], label, at, shift))
    return out


# ── draw.io ──────────────────────────────────────────────────────────────────

def esc(s):
    return html.escape(s, quote=True)


def label(n):
    text = esc(n.text).replace('\n', '<br>')
    if n.role in ('process', 'other') and n.number:
        colour = NUMBER if n.role == 'process' else INK
        return f'<font color="{colour}" style="font-size:15px"><b>{esc(n.number)}</b></font><br>{text}'
    return text


def edge_style(e):
    base = f'html=1;rounded=0;strokeColor={LINE};strokeWidth=1.5;fontSize=12;fontColor={INK};labelBackgroundColor=#ffffff;endSize=8;'
    return base + {
        'flow': 'endArrow=block;endFill=1;',
        'both': 'endArrow=block;endFill=1;',
        'uses': 'endArrow=block;endFill=1;',
        'association': 'endArrow=none;',
        'include': 'endArrow=open;dashed=1;',
        'extend': 'endArrow=open;dashed=1;',
        'generalization': 'endArrow=block;endFill=0;endSize=14;',
    }[e.kind]


def drawio_xml(view):
    by = {n.id: n for n in view.nodes}
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for n in view.nodes:
        parent = n.parent if n.parent in by else '1'
        px, py = (by[parent].x, by[parent].y) if parent != '1' else (0, 0)
        cells.append(f'<mxCell id="{n.id}" value="{esc(label(n))}" style="{STYLE[n.role]}" vertex="1" parent="{parent}">'
                     f'<mxGeometry x="{n.x - px}" y="{n.y - py}" width="{n.w}" height="{n.h}" as="geometry"/></mxCell>')
        if n.role == 'store':
            cells.append(f'<mxCell id="{n.id}~no" value="{esc(n.number)}" style="shape=partialRectangle;html=1;left=0;right=1;top=0;bottom=0;'
                         f'fillColor=none;strokeColor={INK};strokeWidth=2;fontSize=13;fontStyle=1;fontColor={INK};" vertex="1" parent="{n.id}">'
                         f'<mxGeometry x="0" y="0" width="48" height="{n.h}" as="geometry"/></mxCell>')
    for i, (e, s, d, pts, text, at, shift) in enumerate(paths(view)):
        sn, dn = by[s], by[d]
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        rel = lambda n, x, y: (max(0, min(1, (x - n.x) / n.w)), max(0, min(1, (y - n.y) / n.h)))
        ex, ey = rel(sn, x0, y0)
        nx, ny = rel(dn, x1, y1)
        style = edge_style(e) + (f'exitX={ex:.4f};exitY={ey:.4f};exitDx=0;exitDy=0;exitPerimeter=0;'
                                 f'entryX={nx:.4f};entryY={ny:.4f};entryDx=0;entryDy=0;entryPerimeter=0;')
        mid = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in pts[1:-1])
        cells.append(f'<mxCell id="e{i}" value="{esc(text)}" style="{style}" edge="1" parent="1" source="{s}" target="{d}">'
                     f'<mxGeometry x="{at}" relative="1" as="geometry">'
                     + (f'<mxPoint x="{shift[0]}" y="{shift[1]}" as="offset"/>' if shift != (0, 0) else '')
                     + (f'<Array as="points">{mid}</Array>' if mid else '') + '</mxGeometry></mxCell>')
    if view.caption:
        cells.append(f'<mxCell id="caption" value="{esc(view.caption)}" style="text;html=1;align=center;verticalAlign=middle;'
                     f'fontSize=13;fontStyle=2;fontColor={MUTED};" vertex="1" parent="1">'
                     f'<mxGeometry x="0" y="{view.height - 34}" width="{view.width}" height="26" as="geometry"/></mxCell>')
    body = '\n        '.join(cells)
    return f'''<mxfile host="app.diagrams.net">
  <diagram name="{esc(view.title)}">
    <mxGraphModel dx="{view.width}" dy="{view.height}" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{view.width}" pageHeight="{view.height}" background="#ffffff" math="0" shadow="0">
      <root>
        {body}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
'''


def write_drawio():
    drawio = shutil.which('drawio')
    if not drawio:
        sys.exit('drawio (the desktop app CLI) is not on PATH')
    for make in VIEWS:
        v = make()
        out = DRAWIO / v.folder
        out.mkdir(parents=True, exist_ok=True)
        (out / f'{v.stem}.drawio').write_text(drawio_xml(v), encoding='utf-8')
        subprocess.run([drawio, '-x', '-f', 'png', '-s', '2', '-b', '20', '--no-sandbox',
                        '-o', str(out / f'{v.stem}.png'), str(out / f'{v.stem}.drawio')],
                       capture_output=True, check=True)
        print(f'{v.folder}/{v.stem}')


# ── Visual Paradigm ──────────────────────────────────────────────────────────

def vp_records():
    """DIAGRAM, SHAPE and LINK records, as build_spec.py writes them, at fixed positions."""
    clean = lambda s: s.replace('\t', ' ').replace('\n', '\\n')
    rows = []
    for make in VIEWS:
        v = make()
        rows.append(['DIAGRAM', v.vp, v.title, v.folder, v.stem, 'FIXED'])
        for n in v.nodes:
            kind, fill, font = VP_SHAPE[n.role]
            name = f'{n.number} {n.text}' if n.role == 'store' else (f'{n.number}\n{n.text}' if n.number else n.text)
            rows.append(['SHAPE', n.id, kind, str(n.x), str(n.y), str(n.w), str(n.h), clean(name),
                         n.parent, '', fill, font])
        # Visual Paradigm cannot move a line's label off its line. A two-way pair running across
        # the page keeps a label per arrow; one running up and down would stack them, so there
        # the first arrow says both, "sent / back", and the second none.
        by = {n.id: n for n in v.nodes}
        round_ = lambda i: by[i].role in ('process', 'other')
        seen = {}
        for e, s, d, pts, text, at, _shift in paths(v):
            kind = VP_LINK[e.kind]
            # A flowchart start shape (the round process) takes no flowline from another one;
            # an association with an arrowhead joins them instead.
            if kind == 'DataFlow' and round_(s) and round_(d):
                kind = 'DirectedAssociation'
            if e.kind == 'both':
                (x0, y0), (x1, y1) = pts[0], pts[-1]
                across = abs(x1 - x0) >= 2 * abs(y1 - y0)
                first = id(e) not in seen
                seen[id(e)] = True
                if not across:
                    text = e.label if first else ''
            # Visual Paradigm prints «include» and «extend» itself, and draws the head of a
            # generalization or an extend at the "from" end: those two are given reversed.
            if kind in ('Include', 'Extend'):
                text = text.replace('«include»', '').replace('«extend»', '').strip()
            if kind in ('Generalization', 'Extend'):
                s, d, pts = d, s, list(reversed(pts))
            rows.append(['LINK', kind, s, d, clean(text), '', '',
                         ';'.join(f'{x},{y}' for x, y in pts)])
    return ['\t'.join(r) for r in rows]


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--vpspec':
        Path(sys.argv[2]).write_text('\n'.join(vp_records()) + '\n', encoding='utf-8')
    else:
        write_drawio()
