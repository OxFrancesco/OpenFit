# OpenFit

OpenFit helps people understand and act on their own health and nutrition data while preserving clear safety and consent boundaries.

## Language

**Personal Health-Data Coach**:
The OpenFit role that helps a user understand patterns in their own health data and choose small actions. It is not a clinician and does not diagnose conditions or prescribe treatment.
_Avoid_: AI doctor, medical assistant, autonomous clinician

**Nutrition Entry**:
A user-owned record of one consumed food or drink, including when and how much was consumed and its nutritional values. It may be created from the coach's interpretation or manual input, and the user can always correct or remove it.
_Avoid_: Agent memory, immutable food log

**OpenFit-Owned Nutrition Entry**:
A Nutrition Entry created by OpenFit and tracked through its ownership ledger. OpenFit may correct or remove these entries, while nutrition records created by other sources remain read-only.
_Avoid_: Imported nutrition entry, third-party record

**Meal**:
A user-owned grouping of Nutrition Entries consumed together. Each entry remains independently correctable even when the Meal originated from a single photo, receipt, voice message, or conversation.
_Avoid_: Aggregated nutrition entry, indivisible meal log

**Meal Draft**:
A user-owned group of candidate foods that has not yet become canonical nutrition data because personal consumption, quantity, or time is unresolved. Receipt imports begin as Meal Drafts and do not write to Google Health until those facts are established.
_Avoid_: Logged meal, inferred consumption

**Coach Profile**:
The user-controlled facts and preferences the Personal Health-Data Coach may retain across conversations, such as goals, dietary preferences, allergies, units, and communication preferences. It excludes silently inferred diagnoses or permanent medical conclusions.
_Avoid_: Hidden memory, inferred medical profile

**Voice Nutrition Log**:
A spoken meal description that enters the same clarification, estimation, correction, and ownership flow as typed nutrition input. It is not a continuous spoken conversation with the coach.
_Avoid_: Voice agent session, autonomous voice entry

**Coach Conversation**:
A user-owned sequence of messages with the Personal Health-Data Coach that may continue across devices. It can be deleted independently of the Coach Profile and canonical Google Health records.
_Avoid_: Health record, hidden agent memory
