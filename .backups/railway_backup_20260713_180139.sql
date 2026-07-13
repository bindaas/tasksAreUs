--
-- PostgreSQL database dump
--

\restrict puyHX17Y1Hen2WxEU0IGRUluwVFx8Jk8zn8eISkM0BwYwecOefFYaJMa7LbshsO

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: beliefstatusenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.beliefstatusenum AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE public.beliefstatusenum OWNER TO postgres;

--
-- Name: belieftypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.belieftypeenum AS ENUM (
    'label_suggestion',
    'time_estimate'
);


ALTER TYPE public.belieftypeenum OWNER TO postgres;

--
-- Name: categoryenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.categoryenum AS ENUM (
    'mode',
    'type'
);


ALTER TYPE public.categoryenum OWNER TO postgres;

--
-- Name: roleenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.roleenum AS ENUM (
    'user',
    'assistant'
);


ALTER TYPE public.roleenum OWNER TO postgres;

--
-- Name: stateenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.stateenum AS ENUM (
    'pending',
    'done'
);


ALTER TYPE public.stateenum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_cost_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_cost_log (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    feature character varying NOT NULL,
    model character varying NOT NULL,
    input_tokens integer NOT NULL,
    output_tokens integer NOT NULL,
    estimated_cost_usd numeric(10,6) NOT NULL,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE public.ai_cost_log OWNER TO postgres;

--
-- Name: beliefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.beliefs (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    task_id character varying NOT NULL,
    belief_type public.belieftypeenum NOT NULL,
    label_id character varying,
    estimated_minutes integer,
    status public.beliefstatusenum NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.beliefs OWNER TO postgres;

--
-- Name: boards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boards (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    name character varying NOT NULL,
    is_default boolean NOT NULL,
    is_deleted boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    color character varying(7)
);


ALTER TABLE public.boards OWNER TO postgres;

--
-- Name: focused_view_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.focused_view_configs (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    board_selection character varying NOT NULL,
    selected_board_ids jsonb NOT NULL,
    day_range character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.focused_view_configs OWNER TO postgres;

--
-- Name: labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labels (
    id character varying NOT NULL,
    category public.categoryenum NOT NULL,
    value character varying NOT NULL,
    user_id character varying NOT NULL,
    board_id character varying NOT NULL
);


ALTER TABLE public.labels OWNER TO postgres;

--
-- Name: task_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_labels (
    task_id character varying NOT NULL,
    label_id character varying NOT NULL
);


ALTER TABLE public.task_labels OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    title character varying NOT NULL,
    notes text,
    state public.stateenum NOT NULL,
    must_do_by date,
    target_date date,
    completed_at timestamp with time zone,
    is_deleted boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_high_priority boolean DEFAULT false NOT NULL,
    board_id character varying NOT NULL,
    links jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    high_priority_daily_limit integer
);


ALTER TABLE public.user_settings OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    auth_provider character varying,
    auth_provider_id character varying,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    firebase_uid character varying,
    email character varying,
    display_name character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: ai_cost_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_cost_log (id, user_id, feature, model, input_tokens, output_tokens, estimated_cost_usd, created_at) FROM stdin;
\.


--
-- Data for Name: beliefs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.beliefs (id, user_id, task_id, belief_type, label_id, estimated_minutes, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: boards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.boards (id, user_id, name, is_default, is_deleted, created_at, updated_at, color) FROM stdin;
263d0356-da4c-4137-9f35-6ba8006140eb	1b75f432-7cbd-43f4-9e42-6a9c7983740a	General tasks	t	f	2026-06-27 21:59:04.210872+00	2026-06-27 21:59:04.210878+00	\N
68ecfd4e-98fa-4bd6-b706-811916306087	314cb239-fb99-4424-8478-3f6fe1a5ccad	General tasks	t	f	2026-06-27 21:59:04.38326+00	2026-06-27 21:59:04.383265+00	\N
3d343614-d2c1-46e8-8d54-86a2d03f9ead	47895d88-2913-41d3-b367-370107f955f4	General tasks	t	f	2026-06-27 21:59:04.420328+00	2026-06-27 21:59:04.420331+00	\N
c7e9768e-fb4c-4b6b-b309-3932e23b4e61	0776f012-3a28-4e1d-aa8e-d5babcecde35	General tasks	t	f	2026-06-27 21:59:04.460555+00	2026-06-27 21:59:04.460557+00	\N
0221aa32-d9c4-42fb-93de-44db3bf522ca	847c1ef9-b1f0-4b51-9e37-146dc02fd005	General tasks	t	f	2026-06-27 21:59:04.535082+00	2026-06-27 21:59:04.535086+00	\N
0f685964-a891-4bd9-b2ae-7574f7263cd4	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Prof development	f	f	2026-06-28 00:59:45.108404+00	2026-06-28 00:59:45.108407+00	\N
67b3275c-945c-4014-81d3-a2235118d527	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	General tasks	t	f	2026-06-27 21:59:04.267821+00	2026-06-28 01:12:38.894023+00	\N
7cfdb07e-02e5-41f1-8924-9fbc300e940e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Agentic flow	f	f	2026-06-28 14:00:57.986379+00	2026-06-28 14:00:57.986382+00	\N
4116e9a4-0f37-4c96-a589-dca6e2c8977d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Work	f	f	2026-07-01 10:22:22.952522+00	2026-07-01 10:22:22.952526+00	\N
0aedd4df-7e3a-420d-9b65-a1221c82329b	a9da1bf7-15aa-4c93-827d-4cf896e2939d	General tasks	t	f	2026-07-01 13:40:02.079245+00	2026-07-01 13:40:02.07925+00	\N
bf865150-02e9-4b5e-8946-e7d6bc86240e	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	General tasks	t	f	2026-07-03 21:10:39.001457+00	2026-07-03 21:10:39.001461+00	\N
15507f5c-eccd-4edf-8edd-aead7588c787	2462518d-29f4-46a3-9cfe-116aece78b5e	General tasks	t	f	2026-07-03 23:22:55.358629+00	2026-07-03 23:22:55.358635+00	\N
e4c36eaf-f3bd-4512-846d-93cb2a84ddce	2afec1e2-ebe6-4494-aeba-18a3268d22eb	General tasks	t	f	2026-07-04 00:12:07.531016+00	2026-07-04 00:12:07.531023+00	\N
3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5	cca1be35-b414-4cc6-ac62-cc01062e6c45	General tasks	t	f	2026-07-04 00:12:07.578562+00	2026-07-04 00:12:07.578567+00	\N
fed7bd1e-2c79-48af-bf86-63c6ed2125a4	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	General tasks	t	f	2026-07-04 00:13:20.295805+00	2026-07-04 00:13:20.29581+00	\N
8bdedbe8-9c73-4a58-8cf7-5577f284df9a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dev-tasksAreUs	f	f	2026-06-28 00:28:04.06886+00	2026-07-04 00:39:49.206216+00	\N
c9dfea64-d65e-4b69-aa3a-3959c824fbc1	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dev-groceriesAreUs	f	f	2026-06-28 01:03:32.212968+00	2026-07-04 00:39:55.466862+00	\N
99ec8848-ad07-49f7-947d-ff3eb14871d8	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dev-Mexit	f	f	2026-06-30 10:21:35.78802+00	2026-07-04 00:40:02.52924+00	\N
1e025383-0008-4474-acf8-7ea37b342866	2afec1e2-ebe6-4494-aeba-18a3268d22eb	Office	f	f	2026-07-04 15:25:40.322546+00	2026-07-04 15:25:40.322551+00	\N
db447117-683e-4d3d-8da4-0a3bc0cdd0ad	2afec1e2-ebe6-4494-aeba-18a3268d22eb	Financial	f	f	2026-07-04 15:25:59.675285+00	2026-07-04 15:25:59.675288+00	\N
34c1f2a9-8f87-4831-8f9b-00ef0b69a72a	2afec1e2-ebe6-4494-aeba-18a3268d22eb	Household	f	f	2026-07-04 15:25:51.153589+00	2026-07-04 15:26:28.333696+00	\N
\.


--
-- Data for Name: focused_view_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.focused_view_configs (id, user_id, board_selection, selected_board_ids, day_range, created_at, updated_at) FROM stdin;
7ee17bf3-6c91-4735-8121-c23b281bc3a0	a9da1bf7-15aa-4c93-827d-4cf896e2939d	all	[]	today_tomorrow	2026-07-01 13:40:15.634382+00	2026-07-01 13:40:15.634384+00
dc304493-8142-4523-b347-e610f7986d75	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	selected	["67b3275c-945c-4014-81d3-a2235118d527", "8bdedbe8-9c73-4a58-8cf7-5577f284df9a", "0f685964-a891-4bd9-b2ae-7574f7263cd4", "c9dfea64-d65e-4b69-aa3a-3959c824fbc1", "7cfdb07e-02e5-41f1-8924-9fbc300e940e", "99ec8848-ad07-49f7-947d-ff3eb14871d8", "4116e9a4-0f37-4c96-a589-dca6e2c8977d"]	today	2026-07-01 02:18:10.151175+00	2026-07-02 10:40:04.848466+00
d33927d7-73d5-4292-b8e1-2abbe7516b21	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	all	[]	today	2026-07-03 21:10:38.946426+00	2026-07-03 21:10:38.94643+00
0f2a8359-c03a-4fd3-9df6-e547570fa2c1	2afec1e2-ebe6-4494-aeba-18a3268d22eb	all	[]	today	2026-07-03 21:11:49.900785+00	2026-07-03 21:11:49.900789+00
64fc10fb-a6c9-4a6a-a63f-74859d42e26e	2462518d-29f4-46a3-9cfe-116aece78b5e	all	[]	today	2026-07-03 23:23:01.655114+00	2026-07-03 23:23:01.655117+00
a8969ba3-1e2f-41a7-ab44-0d2ca1c0d2cd	cca1be35-b414-4cc6-ac62-cc01062e6c45	all	[]	today	2026-07-03 23:23:50.218824+00	2026-07-03 23:23:50.218828+00
\.


--
-- Data for Name: labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.labels (id, category, value, user_id, board_id) FROM stdin;
c2f84619-71cb-4cee-84dc-07d914fec867	type	Web	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
3990ec47-347f-48ec-ae7e-5204827b69ac	type	Data	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
10d5d5eb-c039-486d-902c-990e4c100175	type	Bug	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
d48a5292-64d8-498b-8232-9bb7e734f28c	type	Usability	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
47c29002-ca10-4638-9373-13c22f871bff	type	Telemetrics	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
8e13edef-c2a4-45c2-90cf-36e8f0f2d58f	type	Read	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
472dc2e7-8ec0-485c-ba5b-22cf3d3b776f	type	Learn	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
52cd3221-07e8-4192-9dbd-b1b2e21c5eb4	type	Work	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
2c859e1d-cc44-4459-9704-0be941ea576c	type	Web	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	c9dfea64-d65e-4b69-aa3a-3959c824fbc1
132b52cb-6ba5-4035-ad11-eb52c5814250	type	Mobile	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	c9dfea64-d65e-4b69-aa3a-3959c824fbc1
23c08acf-c820-4123-a7e7-50f02f9f773e	type	Review	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	c9dfea64-d65e-4b69-aa3a-3959c824fbc1
ae33ecb1-cdb5-49a8-8463-a28ebe32351e	mode	online	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
d4edf508-d23a-4c67-8f35-854f7d29b2a2	mode	phone	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
982ddd9b-9381-4c89-a791-2945011c6245	type	household	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
ade63a46-d8b1-4305-abe1-17b5085cd480	type	financial	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
6ee140a6-615a-44e1-baaf-521c13f0edd8	type	trip	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
f2c9e628-b49f-423d-822a-f018830b7758	type	medical	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
defb4a59-36af-4268-8124-7a62fc5dec9b	mode	outdoor	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
b32e8690-8ce4-4a57-9456-c90b0009aef8	type	household	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
95505c6f-7364-46e1-abb4-5da79fb1bd91	type	child	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
b758b6c7-eeaa-4811-b15b-fe3148182d51	mode	phone	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
364e72fd-b7e4-424e-9aba-dc3b0acd9420	mode	email	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
afd64aef-eaeb-4aa0-bc7e-c4b05d3c1a3e	mode	online	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
7c9c0aed-1b68-43c6-8f71-89249c2b93ca	type	financial	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
951aa52c-f32d-45d5-9002-b84a074e928b	type	trip	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
e1700ddb-2aee-45c3-b317-02d83734875b	type	medical	314cb239-fb99-4424-8478-3f6fe1a5ccad	68ecfd4e-98fa-4bd6-b706-811916306087
d691c913-6748-401f-a4ff-b59282b22a8a	mode	phone	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
c6c08dcb-729f-4087-ad67-f50361a16378	mode	email	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
1c49c4c0-2bf4-4c91-86b1-bd9c5c020a83	mode	online	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
19a717a2-9faa-44de-9b87-2352b1998cc8	type	financial	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
4e668bf7-281a-44e3-b3cd-95013cdc5517	type	medical	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
76f3250f-7b95-492e-a5dd-6a7a3b83b44e	type	trip	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
ae3897e4-b56e-4db6-a0b4-efaae38f00c1	mode	outdoor	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
5a6c36c1-1fd6-4b36-9bae-14c7a608d70f	type	household	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
36d74acd-395a-41fd-9656-0decb7b3fa4d	mode	online	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
4e8a4c49-f1ce-46e1-8439-cf74d49c4afe	mode	phone	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
5c1cd478-a82b-49ce-afd4-bbe758df0d9b	mode	outdoor	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
6e1aecd1-4717-487a-b41f-53a62fab34ec	mode	email	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
f8aac2ab-7414-45de-a372-a401f5f84867	type	household	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
8ac65cb9-a8ec-4d22-bb88-dbcdeef3cc20	type	financial	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
cbc60d55-777b-4329-866c-e14f579a4626	type	child	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
211a19b7-572f-490a-9d89-d6a4c1e9775a	mode	online	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
97a8fe0c-1343-47f8-bb88-a731141180fa	mode	phone	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
4d9823d8-d39a-4cb4-9924-b728390315f3	mode	outdoor	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
35b848b1-10cc-4bbd-af67-08abc0ea4831	mode	email	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
cd224692-335e-48a7-92a4-36e53868c3f2	type	household	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
fea6e47b-eaeb-4f1f-8e49-02ebe82c342d	type	financial	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
7a620464-6f43-48f6-b599-981802ce9a63	type	child	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
dfc39e19-8d53-4e55-babe-65f9e2c46349	type	household	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
eeae00fd-b8f8-4f41-8b19-3346a2c9a4de	type	child	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
a0bab115-4020-484e-832e-e97fc835913f	mode	outdoor	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
6b0d86d7-390b-49f3-b1cc-6b2713ed06e1	type	trip	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
5f1040f7-4c13-4f1a-b521-5b1927884671	type	medical	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
937429c6-9c1e-4104-af4d-da2405a6d2af	mode	online	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
2c49691e-db84-4c05-9165-90d27981a4e7	type	financial	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
1a4c8e96-5645-4fe0-82f4-c7d91ea2e6ea	mode	email	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
f388b198-8036-49d7-8c21-43257d5704f1	mode	phone	1b75f432-7cbd-43f4-9e42-6a9c7983740a	263d0356-da4c-4137-9f35-6ba8006140eb
ab6efbc0-103a-4c92-9823-37e84c71b245	type	Raghav	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a	type	moi	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
72b24e3d-7b67-427d-b662-22eb594f478b	type	Work	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
19a55aba-cdda-479e-b8dd-5c731e2c4916	type	Shop	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
84d2e386-7c2a-4539-96fe-242be799b262	type	Returns	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
2c91e4fd-b900-4504-a94a-d2be2fe75273	type	mexit	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
ea56b52a-d685-4111-b6ce-98caa841a156	type	child	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
4746f18e-ac9d-4d1d-89b5-76d3bf1eae29	type	child	47895d88-2913-41d3-b367-370107f955f4	3d343614-d2c1-46e8-8d54-86a2d03f9ead
8d460858-692c-423a-bafc-de2d156e86cf	type	trip	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
87c0f968-6358-42a4-9fc4-866a422dd82b	type	medical	0776f012-3a28-4e1d-aa8e-d5babcecde35	c7e9768e-fb4c-4b6b-b309-3932e23b4e61
3e34800a-8869-4396-8d27-046785784818	type	trip	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
2e0f649b-4e7d-4dff-ab8c-8eb7af394c1d	type	medical	847c1ef9-b1f0-4b51-9e37-146dc02fd005	0221aa32-d9c4-42fb-93de-44db3bf522ca
b1ed2fe6-ace7-4807-ab32-4efae5010a61	type	Mobile	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
c9bfc7c6-04ea-480a-bc8b-466de3825a47	type	Release	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
96b31c95-7476-4f1b-8943-d87bb8049f94	type	New feature	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
c22f5cb0-b61d-4d1a-9a7f-2b5ce908b6ed	type	Write	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
fd5a5fab-42a6-4f85-98f1-47a384c2c86e	type	Usability	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	c9dfea64-d65e-4b69-aa3a-3959c824fbc1
3856fdc1-d25b-4607-89fb-c787e4490dc2	type	Review	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
34df53d2-0ca7-49a7-9b46-36e432259c9d	type	New feature	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	c9dfea64-d65e-4b69-aa3a-3959c824fbc1
4f44e4c1-4cf1-4860-ae7c-dc070d981006	type	Rules-of-engagement	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	7cfdb07e-02e5-41f1-8924-9fbc300e940e
b53921fb-36ac-475a-906a-bd401a5fe9f7	type	Explore	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
140fa20a-3fa9-44a3-a51e-a02c76105ab0	mode	outdoor	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
b088345c-f057-465c-8ef3-9c981c2bec59	mode	email	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
25834028-99a4-4b34-819e-e1c1a1fc1ca4	type	household	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
cf59f52d-fd40-4310-8020-f745f55408c1	type	financial	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
64da132e-2d3e-4f82-ac60-1e1ed6fa738b	type	child	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
e74bf17d-64b9-4099-bdc9-17bc90d226d2	type	trip	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
e35e9abe-f031-4eff-a0e9-f34c95d03892	type	medical	a9da1bf7-15aa-4c93-827d-4cf896e2939d	0aedd4df-7e3a-420d-9b65-a1221c82329b
9ccc168c-64b6-4939-852a-40786a963644	type	Admin	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
f781607d-daa4-4134-bead-498e4afe70b0	type	SHP	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
fd461f11-c9ce-4f3c-be6a-cc82374644e7	type	AIS-OS	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
000f81d0-c696-4f6a-bdd9-1d14aac60b63	type	Demohub	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
3f3edc5d-8fa6-4558-83db-46a690c0f30b	type	Backups	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
bd34fbf6-e632-482b-82e5-7e7640132996	type	Refactor	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
b3062308-cf48-4010-b77a-779e5740faaa	mode	online	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
6a839431-61f8-4ff9-a180-45d495c3f5b4	mode	phone	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
0eacd4d0-d5a6-4a65-82bf-8dc4a6b5fa8e	mode	outdoor	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
e9c0a6de-e80e-48a4-94d5-42efb2194eb0	mode	email	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
0360671f-0c13-46e3-9098-50ca020a42bd	type	household	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
be542458-d41e-4238-b5db-2de33fa37839	type	financial	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
f7fbe897-856a-4f31-98d4-cbaada2b00f7	type	child	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
f4eca9b7-3e73-42b3-bbdb-39a61a1a9a47	type	trip	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
927fe0b5-5a47-4cb4-9f97-259f52157872	type	medical	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	bf865150-02e9-4b5e-8946-e7d6bc86240e
edd29a84-3b5a-4a04-b991-5e81c60cfa40	mode	online	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
ed00acb4-fc13-4e73-b938-3194101da731	mode	phone	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
4ed2cafa-dfd7-4fae-9c87-7f96bfdbba81	mode	outdoor	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
7d64a602-6deb-4879-af4c-45ded4c23b5b	mode	email	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
c45bd36c-86cb-4481-aa33-fe442a44225a	type	household	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
67fe86fb-6724-47eb-bbfa-cabc25bdc577	type	financial	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
a1729629-dff1-43e7-8a44-508dde1b4dad	type	child	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
9a776755-eed2-4d87-9226-41f454e0b7a5	type	trip	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
271d79cf-430b-4a5a-9729-416d05721328	type	medical	2462518d-29f4-46a3-9cfe-116aece78b5e	15507f5c-eccd-4edf-8edd-aead7588c787
3c340b5c-09f6-4a19-91d2-ec84477a0f99	mode	online	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
05a78caf-265b-4610-b176-b45ece55d3ad	mode	phone	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
7e1cda8e-aff1-466c-afdd-b0568f3dfce8	mode	outdoor	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
bbb72cb7-6952-4c97-92b2-c8ac0991db74	mode	email	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
f7fc6e00-acd9-4567-b71c-cf9364f5beab	type	household	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
43247469-a868-4a7b-bf2d-8b1eb4a6355e	type	financial	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
1a7351fe-f0dd-49b4-8a61-8c0ace16e927	type	child	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
c9ee1300-ccff-4281-b5a1-1c6da8f806da	type	trip	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
f15c5691-78da-4a2f-83be-7b3f83fb994f	type	medical	2afec1e2-ebe6-4494-aeba-18a3268d22eb	e4c36eaf-f3bd-4512-846d-93cb2a84ddce
8b2553ed-e096-4e2f-b96e-ce49d7fe4c8c	mode	online	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
49a5d1db-d4d6-423e-bdb4-24256f744360	mode	phone	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
0582fd79-1c1a-4cec-81e7-356c427f905c	mode	outdoor	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
a2949f62-e112-49e2-8ee0-ca82c827d8bf	mode	email	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
b4245e95-7b94-4ad6-81a5-2cebcc100b40	type	household	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
ed2026fe-b24c-43a8-b28b-ebdb9973f4bf	type	financial	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
e5b3bfd1-be2d-40fd-b425-0477f7d71047	type	child	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
93a1dd6c-5bba-44d6-b119-cad07e86b6dd	type	trip	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
6fb19ef7-6e53-45a7-bf6b-60a3015bcce6	type	medical	cca1be35-b414-4cc6-ac62-cc01062e6c45	3eefedd9-a2b3-4c2a-bf6e-35fbf4ad66a5
2b619d3f-3411-46d8-aefd-e7f73f16f1d3	mode	online	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
506eaa6f-026d-4fe6-bcaa-4742151b1eb5	mode	phone	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
878219f3-d865-494e-91c4-6155dbad5ffe	mode	outdoor	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
21c9c45d-cf0a-46af-83a1-2986a24eb2ff	mode	email	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
15b41d1f-a919-4dcd-9e21-18c2943a5758	type	household	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
4a22033e-d93f-4543-af5a-b87d03347162	type	financial	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
a8e9edd2-9a01-424b-b130-48680773f598	type	child	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
8c92e055-cec2-4c7d-a3b9-380ed551d3a7	type	trip	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
5c8f672a-fd7c-4a33-a9f9-5e040ec13189	type	medical	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	fed7bd1e-2c79-48af-bf86-63c6ed2125a4
bc51f687-e4d7-4f99-9991-ac0384bb2122	type	Next	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
408ea635-864d-48d3-a422-dfe2d0559466	type	Lab Management	2afec1e2-ebe6-4494-aeba-18a3268d22eb	1e025383-0008-4474-acf8-7ea37b342866
339860c8-b07f-495a-b5d6-c58a35510feb	type	Research	2afec1e2-ebe6-4494-aeba-18a3268d22eb	1e025383-0008-4474-acf8-7ea37b342866
3ba94b77-1394-4f14-a71e-3e818232cf0d	type	Student Mentoring	2afec1e2-ebe6-4494-aeba-18a3268d22eb	1e025383-0008-4474-acf8-7ea37b342866
21152811-90c5-4b3e-a970-cceb922514e4	type	QCon	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
d96c6bbc-9da8-4200-9128-3096a1c8c59c	type	What-is	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	0f685964-a891-4bd9-b2ae-7574f7263cd4
16ad6d6b-c636-4907-a7e2-a6c9fe7b215e	type	Next plus	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
13336f84-784f-4ce5-b372-88a3532f347d	type	AIS-IA-Workflow	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
d73c59b5-e52b-45b5-9dc3-0ed9f1cff82b	type	Claude	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
bd532d08-9d2c-43e0-94c8-2f4a59343eea	type	Now	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	8bdedbe8-9c73-4a58-8cf7-5577f284df9a
58d873e3-2b47-47a5-8b38-4fe48642aa22	type	Wait-Followup	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
ac325118-570b-4ded-82bd-5270593e9b4c	type	Meeting Prep	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
0cc7829f-ca1e-49b9-9f45-d7481c14e28f	type	Review	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
c9ef50c4-c8f0-46c2-95bd-df546d6007e9	type	Reports	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
3d5ba8fd-78d2-4c9a-ac32-d3eb72dac997	type	Process	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
c098689c-5f8e-420b-8fc9-3cf3d255c9a9	type	Online	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
a8afc231-8f68-4281-960d-9a78f4e00d86	type	Phone	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
f22f4178-a83e-41f9-a26a-d5941cd0e62d	type	Outdoor	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
e75fbf5d-b95b-4ec9-bdc3-34b2b5036c97	type	Email	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
51691921-3e09-4df6-bc43-17955d07ce06	type	Next	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	67b3275c-945c-4014-81d3-a2235118d527
0d463d97-e9fc-4a68-9cf7-e7d28d8a5e6e	type	Learn	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
d12790a7-b07f-40f8-a7ca-1b36b3353b92	type	OpenSource	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
2691713c-d6a7-458c-a4a6-970deabec41c	type	Do-it	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	4116e9a4-0f37-4c96-a589-dca6e2c8977d
\.


--
-- Data for Name: task_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_labels (task_id, label_id) FROM stdin;
26474cf1-142d-444c-ac14-1ea8bbbdfd2a	f781607d-daa4-4134-bead-498e4afe70b0
26474cf1-142d-444c-ac14-1ea8bbbdfd2a	58d873e3-2b47-47a5-8b38-4fe48642aa22
bfa7e2ad-c42b-4e80-96af-dc0cf7dcd256	d73c59b5-e52b-45b5-9dc3-0ed9f1cff82b
4c7b5aff-1ba3-469d-b4a3-bee3903f456e	ade63a46-d8b1-4305-abe1-17b5085cd480
4c7b5aff-1ba3-469d-b4a3-bee3903f456e	ab6efbc0-103a-4c92-9823-37e84c71b245
4c7b5aff-1ba3-469d-b4a3-bee3903f456e	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
4c7b5aff-1ba3-469d-b4a3-bee3903f456e	a8afc231-8f68-4281-960d-9a78f4e00d86
7b19958f-30a2-4028-9ef3-88e2c31aaefb	ab6efbc0-103a-4c92-9823-37e84c71b245
bfa7e2ad-c42b-4e80-96af-dc0cf7dcd256	ac325118-570b-4ded-82bd-5270593e9b4c
4c5a341d-c42d-4d01-b9e8-e3e39c00f344	f781607d-daa4-4134-bead-498e4afe70b0
4c5a341d-c42d-4d01-b9e8-e3e39c00f344	ac325118-570b-4ded-82bd-5270593e9b4c
b7a0ffe4-b777-4405-8005-04b9557098c6	b1ed2fe6-ace7-4807-ab32-4efae5010a61
17f06f95-d928-44db-800f-fddb968396db	f2c9e628-b49f-423d-822a-f018830b7758
7b19958f-30a2-4028-9ef3-88e2c31aaefb	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
dd2a5787-90c8-43e1-a8aa-4aaed230cb88	ab6efbc0-103a-4c92-9823-37e84c71b245
dd2a5787-90c8-43e1-a8aa-4aaed230cb88	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2151d91f-3441-439d-a156-d01407d6eee6	ab6efbc0-103a-4c92-9823-37e84c71b245
829c0b4c-96d6-40df-a18e-341edd39291a	ade63a46-d8b1-4305-abe1-17b5085cd480
8169f596-1d5b-4511-bb17-5c9c1eb8288b	58d873e3-2b47-47a5-8b38-4fe48642aa22
829c0b4c-96d6-40df-a18e-341edd39291a	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
9bfeac3c-e07f-4d18-86fe-cdce25207fc6	bd34fbf6-e632-482b-82e5-7e7640132996
9bfeac3c-e07f-4d18-86fe-cdce25207fc6	bc51f687-e4d7-4f99-9991-ac0384bb2122
8c63a567-38ac-44ce-a5c2-07c5b9c79926	ab6efbc0-103a-4c92-9823-37e84c71b245
89b4f500-e31e-472f-9394-bd4cd1b72c39	c2f84619-71cb-4cee-84dc-07d914fec867
8c63a567-38ac-44ce-a5c2-07c5b9c79926	a8afc231-8f68-4281-960d-9a78f4e00d86
8c63a567-38ac-44ce-a5c2-07c5b9c79926	e75fbf5d-b95b-4ec9-bdc3-34b2b5036c97
fa36cccd-ab1d-44b8-b46a-a5bc0143e4aa	f2c9e628-b49f-423d-822a-f018830b7758
8c63a567-38ac-44ce-a5c2-07c5b9c79926	51691921-3e09-4df6-bc43-17955d07ce06
8169f596-1d5b-4511-bb17-5c9c1eb8288b	ac325118-570b-4ded-82bd-5270593e9b4c
2fa73292-8284-490d-9753-1a75ac8a0f4c	2c91e4fd-b900-4504-a94a-d2be2fe75273
8169f596-1d5b-4511-bb17-5c9c1eb8288b	3d5ba8fd-78d2-4c9a-ac32-d3eb72dac997
6cd210a4-a9bb-419c-8384-4118c9f0d577	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
d9f52515-982c-4052-a311-365de4747967	982ddd9b-9381-4c89-a791-2945011c6245
fa36cccd-ab1d-44b8-b46a-a5bc0143e4aa	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
9913efe6-c9b4-47a9-8d73-130b3c379bb5	f2c9e628-b49f-423d-822a-f018830b7758
9913efe6-c9b4-47a9-8d73-130b3c379bb5	ab6efbc0-103a-4c92-9823-37e84c71b245
9913efe6-c9b4-47a9-8d73-130b3c379bb5	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
cb33d643-bb80-4faf-8e3c-c10e5f80d902	472dc2e7-8ec0-485c-ba5b-22cf3d3b776f
cb33d643-bb80-4faf-8e3c-c10e5f80d902	d96c6bbc-9da8-4200-9128-3096a1c8c59c
1406ed9f-6cbb-4ad8-89b7-9353463b9595	ade63a46-d8b1-4305-abe1-17b5085cd480
0fa0ad05-d4ab-49de-a7a5-9bc14318339e	f2c9e628-b49f-423d-822a-f018830b7758
380b9b1c-22fd-4e6f-b396-4d20bc883ced	8e13edef-c2a4-45c2-90cf-36e8f0f2d58f
0fa0ad05-d4ab-49de-a7a5-9bc14318339e	ab6efbc0-103a-4c92-9823-37e84c71b245
6dd2387c-6407-4672-b1cb-c701da3e57e0	0d463d97-e9fc-4a68-9cf7-e7d28d8a5e6e
6dd2387c-6407-4672-b1cb-c701da3e57e0	2691713c-d6a7-458c-a4a6-970deabec41c
380b9b1c-22fd-4e6f-b396-4d20bc883ced	472dc2e7-8ec0-485c-ba5b-22cf3d3b776f
89b4f500-e31e-472f-9394-bd4cd1b72c39	d48a5292-64d8-498b-8232-9bb7e734f28c
49888de1-cddf-4da8-b71a-feed2b2ef87e	b1ed2fe6-ace7-4807-ab32-4efae5010a61
49888de1-cddf-4da8-b71a-feed2b2ef87e	c9bfc7c6-04ea-480a-bc8b-466de3825a47
86278046-634a-4691-8aea-6aa1e97d0a58	fd461f11-c9ce-4f3c-be6a-cc82374644e7
86278046-634a-4691-8aea-6aa1e97d0a58	d12790a7-b07f-40f8-a7ca-1b36b3353b92
86278046-634a-4691-8aea-6aa1e97d0a58	2691713c-d6a7-458c-a4a6-970deabec41c
a12daf8f-cfe4-4157-8c8e-340df9c72b3f	2c859e1d-cc44-4459-9704-0be941ea576c
a12daf8f-cfe4-4157-8c8e-340df9c72b3f	132b52cb-6ba5-4035-ad11-eb52c5814250
a12daf8f-cfe4-4157-8c8e-340df9c72b3f	fd5a5fab-42a6-4f85-98f1-47a384c2c86e
ed578d51-2043-4179-b9ca-dd133580cb4b	132b52cb-6ba5-4035-ad11-eb52c5814250
9c0c0970-54d9-4a0a-91e1-6451f5fb13dc	132b52cb-6ba5-4035-ad11-eb52c5814250
097e0725-dd49-4ab9-a1af-dbb4172554d4	c2f84619-71cb-4cee-84dc-07d914fec867
097e0725-dd49-4ab9-a1af-dbb4172554d4	d48a5292-64d8-498b-8232-9bb7e734f28c
097e0725-dd49-4ab9-a1af-dbb4172554d4	b1ed2fe6-ace7-4807-ab32-4efae5010a61
6e55587d-b8c4-4dd5-9692-271bc6e7ef1c	34df53d2-0ca7-49a7-9b46-36e432259c9d
8f4ba6bf-4af4-4a8a-ab8d-b069ff14d56d	23c08acf-c820-4123-a7e7-50f02f9f773e
f72e1e54-7764-447f-9268-43a4e1a58fd5	4f44e4c1-4cf1-4860-ae7c-dc070d981006
179bb6d0-ceda-4628-9aac-c257c3fd1083	8e13edef-c2a4-45c2-90cf-36e8f0f2d58f
104addcc-db03-4039-b9c2-6d855020c1dc	8e13edef-c2a4-45c2-90cf-36e8f0f2d58f
4c77b173-38bf-4590-8e5e-6a676c9348e9	d48a5292-64d8-498b-8232-9bb7e734f28c
4c77b173-38bf-4590-8e5e-6a676c9348e9	bc51f687-e4d7-4f99-9991-ac0384bb2122
b269ff92-23ea-4124-a20a-2bee9bccf666	6ee140a6-615a-44e1-baaf-521c13f0edd8
69505c4e-d8c7-42ee-a0d4-bbef8676a17b	0cc7829f-ca1e-49b9-9f45-d7481c14e28f
1a3945c0-7f19-4a0f-9c42-2294633f6c37	ade63a46-d8b1-4305-abe1-17b5085cd480
1a3945c0-7f19-4a0f-9c42-2294633f6c37	ab6efbc0-103a-4c92-9823-37e84c71b245
69505c4e-d8c7-42ee-a0d4-bbef8676a17b	c9ef50c4-c8f0-46c2-95bd-df546d6007e9
b2a6e239-517b-407f-a581-9fdc54c370b0	9ccc168c-64b6-4939-852a-40786a963644
5bea8d2a-31c2-435c-8a93-1406f0df48d6	19a55aba-cdda-479e-b8dd-5c731e2c4916
de141805-1d65-4722-8b2b-26a8e196b2f7	f2c9e628-b49f-423d-822a-f018830b7758
f95245e6-6e0a-4d46-af4a-b96954ccb966	b1ed2fe6-ace7-4807-ab32-4efae5010a61
4f8eb8fc-0862-4463-b505-d6b7f7034e7a	982ddd9b-9381-4c89-a791-2945011c6245
5dc8005a-56f7-4463-99e1-a661c7ed4576	ade63a46-d8b1-4305-abe1-17b5085cd480
5dc8005a-56f7-4463-99e1-a661c7ed4576	ab6efbc0-103a-4c92-9823-37e84c71b245
67b1590f-b9f1-4937-ab6a-115cb2b7ac46	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
9a43b66f-a581-459a-a4ce-7bc4b24f6c96	84d2e386-7c2a-4539-96fe-242be799b262
f95245e6-6e0a-4d46-af4a-b96954ccb966	c9bfc7c6-04ea-480a-bc8b-466de3825a47
c9b673fd-e4d5-42ef-8ae0-3f5f2a242d86	d48a5292-64d8-498b-8232-9bb7e734f28c
faf9cf74-82fa-4b13-ab7d-46e8f6ee29cb	47c29002-ca10-4638-9373-13c22f871bff
67b1590f-b9f1-4937-ab6a-115cb2b7ac46	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
e0c308b5-df46-4a65-b560-f4b30a225c7c	ade63a46-d8b1-4305-abe1-17b5085cd480
77a98ab3-51bb-48c5-8c6c-0a19d985db2d	f2c9e628-b49f-423d-822a-f018830b7758
de141805-1d65-4722-8b2b-26a8e196b2f7	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
de141805-1d65-4722-8b2b-26a8e196b2f7	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
0b473495-eac6-4d9f-9cad-75ca7877fef5	c2f84619-71cb-4cee-84dc-07d914fec867
0b473495-eac6-4d9f-9cad-75ca7877fef5	d48a5292-64d8-498b-8232-9bb7e734f28c
0b473495-eac6-4d9f-9cad-75ca7877fef5	b1ed2fe6-ace7-4807-ab32-4efae5010a61
de141805-1d65-4722-8b2b-26a8e196b2f7	a8afc231-8f68-4281-960d-9a78f4e00d86
022b4a22-2f41-4f80-b848-6da6fb1d4cea	ab6efbc0-103a-4c92-9823-37e84c71b245
8139189a-8f56-4800-a905-e7b5f6b69563	d48a5292-64d8-498b-8232-9bb7e734f28c
8139189a-8f56-4800-a905-e7b5f6b69563	b1ed2fe6-ace7-4807-ab32-4efae5010a61
b3249ffa-5ed7-4d60-86fe-68bffba82b9d	d48a5292-64d8-498b-8232-9bb7e734f28c
b3249ffa-5ed7-4d60-86fe-68bffba82b9d	b1ed2fe6-ace7-4807-ab32-4efae5010a61
a2bf5b77-30db-42f2-8685-fd85c4515928	b1ed2fe6-ace7-4807-ab32-4efae5010a61
a2bf5b77-30db-42f2-8685-fd85c4515928	c9bfc7c6-04ea-480a-bc8b-466de3825a47
92d78fb6-12f9-42db-903e-f9b698b9bbff	9ccc168c-64b6-4939-852a-40786a963644
a5f61bb7-5d4d-47a6-aa27-fed1dacf8179	d48a5292-64d8-498b-8232-9bb7e734f28c
1cbbdff0-61e5-4f8a-8fca-74dfd489fa41	d48a5292-64d8-498b-8232-9bb7e734f28c
1cbbdff0-61e5-4f8a-8fca-74dfd489fa41	bc51f687-e4d7-4f99-9991-ac0384bb2122
022b4a22-2f41-4f80-b848-6da6fb1d4cea	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2ecf0a02-81ab-4e1e-86a8-ba54987e9fef	408ea635-864d-48d3-a422-dfe2d0559466
a5f61bb7-5d4d-47a6-aa27-fed1dacf8179	bc51f687-e4d7-4f99-9991-ac0384bb2122
65fa4a8f-2d59-41cd-936d-9be860a38f3b	bd34fbf6-e632-482b-82e5-7e7640132996
65fa4a8f-2d59-41cd-936d-9be860a38f3b	bd532d08-9d2c-43e0-94c8-2f4a59343eea
525aeb1b-f6c1-4333-a6a5-fc0c318de35a	ade63a46-d8b1-4305-abe1-17b5085cd480
525aeb1b-f6c1-4333-a6a5-fc0c318de35a	ab6efbc0-103a-4c92-9823-37e84c71b245
525aeb1b-f6c1-4333-a6a5-fc0c318de35a	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
ec9a4b24-858b-4fa7-aa4d-d3db619a3d37	ade63a46-d8b1-4305-abe1-17b5085cd480
81a2dafc-3e0b-455f-af09-c2944f4d3adc	6ee140a6-615a-44e1-baaf-521c13f0edd8
ec9a4b24-858b-4fa7-aa4d-d3db619a3d37	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2095a01f-4810-4eed-831b-7eb785c902fa	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2095a01f-4810-4eed-831b-7eb785c902fa	f22f4178-a83e-41f9-a26a-d5941cd0e62d
81ca7734-dd07-4076-816e-4701afe80e3f	ade63a46-d8b1-4305-abe1-17b5085cd480
81ca7734-dd07-4076-816e-4701afe80e3f	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
98a33250-ae4a-4990-a3a0-b6d3977c3fff	ade63a46-d8b1-4305-abe1-17b5085cd480
17f06f95-d928-44db-800f-fddb968396db	ab6efbc0-103a-4c92-9823-37e84c71b245
98a33250-ae4a-4990-a3a0-b6d3977c3fff	ab6efbc0-103a-4c92-9823-37e84c71b245
98a33250-ae4a-4990-a3a0-b6d3977c3fff	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
e1e40091-a95e-4bf7-a11a-98457263dc3c	ade63a46-d8b1-4305-abe1-17b5085cd480
b342a1ab-c5eb-45d5-a418-7245510885b9	c22f5cb0-b61d-4d1a-9a7f-2b5ce908b6ed
e1e40091-a95e-4bf7-a11a-98457263dc3c	ab6efbc0-103a-4c92-9823-37e84c71b245
e1e40091-a95e-4bf7-a11a-98457263dc3c	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
ba09dda0-7f2c-41c0-a5c5-d7165d138f47	ab6efbc0-103a-4c92-9823-37e84c71b245
eb752fbc-b32e-4317-a8c3-328c45e467bf	ab6efbc0-103a-4c92-9823-37e84c71b245
a75da209-1832-46f2-8475-78b683f24317	0d463d97-e9fc-4a68-9cf7-e7d28d8a5e6e
a75da209-1832-46f2-8475-78b683f24317	d12790a7-b07f-40f8-a7ca-1b36b3353b92
a75da209-1832-46f2-8475-78b683f24317	2691713c-d6a7-458c-a4a6-970deabec41c
cd9fb1fe-ddb6-47e6-b7dd-242596d8f443	58d873e3-2b47-47a5-8b38-4fe48642aa22
6f8a7ae8-22a0-416e-8c97-7c91d6727fbf	d48a5292-64d8-498b-8232-9bb7e734f28c
6f8a7ae8-22a0-416e-8c97-7c91d6727fbf	bd532d08-9d2c-43e0-94c8-2f4a59343eea
8c72ca3d-2c6e-42ff-9fe4-3289c3cabb32	bd34fbf6-e632-482b-82e5-7e7640132996
8c72ca3d-2c6e-42ff-9fe4-3289c3cabb32	bd532d08-9d2c-43e0-94c8-2f4a59343eea
7f886bdf-add2-419f-b0ec-78f105d682df	96b31c95-7476-4f1b-8943-d87bb8049f94
7f886bdf-add2-419f-b0ec-78f105d682df	bc51f687-e4d7-4f99-9991-ac0384bb2122
d7b59b0b-b011-4047-b458-00b80bd840ad	d48a5292-64d8-498b-8232-9bb7e734f28c
d7b59b0b-b011-4047-b458-00b80bd840ad	bc51f687-e4d7-4f99-9991-ac0384bb2122
834d8b37-09b9-4dbd-a498-46f28d02e85f	ac325118-570b-4ded-82bd-5270593e9b4c
1111d42f-aa83-4ed5-bbba-7d533cd977f8	ac325118-570b-4ded-82bd-5270593e9b4c
54afc9ca-bf34-4aec-ba77-ac3e7fed9e66	72b24e3d-7b67-427d-b662-22eb594f478b
5a20c6af-f247-43f5-9d40-451881ee61ad	19a55aba-cdda-479e-b8dd-5c731e2c4916
54afc9ca-bf34-4aec-ba77-ac3e7fed9e66	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
54afc9ca-bf34-4aec-ba77-ac3e7fed9e66	a8afc231-8f68-4281-960d-9a78f4e00d86
ca07ba20-a6d7-4e2a-8dda-20d7ed436a47	ab6efbc0-103a-4c92-9823-37e84c71b245
629dd23b-ec2c-4862-aa36-97080f584bbe	c2f84619-71cb-4cee-84dc-07d914fec867
629dd23b-ec2c-4862-aa36-97080f584bbe	d48a5292-64d8-498b-8232-9bb7e734f28c
629dd23b-ec2c-4862-aa36-97080f584bbe	b1ed2fe6-ace7-4807-ab32-4efae5010a61
21ff6342-63dc-4fbb-99aa-f2667b5a0fb9	d48a5292-64d8-498b-8232-9bb7e734f28c
21ff6342-63dc-4fbb-99aa-f2667b5a0fb9	b1ed2fe6-ace7-4807-ab32-4efae5010a61
bddd54ed-90bd-46db-a727-addd06a39115	c2f84619-71cb-4cee-84dc-07d914fec867
bddd54ed-90bd-46db-a727-addd06a39115	bc51f687-e4d7-4f99-9991-ac0384bb2122
6790bb98-60a3-462a-8ff3-07d9497c1c81	d48a5292-64d8-498b-8232-9bb7e734f28c
054e4914-9812-40de-a922-730d778765a0	2c859e1d-cc44-4459-9704-0be941ea576c
054e4914-9812-40de-a922-730d778765a0	132b52cb-6ba5-4035-ad11-eb52c5814250
bfcbe850-c2d1-49c6-9a0b-29053b9ddf8c	ade63a46-d8b1-4305-abe1-17b5085cd480
dcf76ec5-5b2f-40b7-8fbf-7a4a1b364cb7	ade63a46-d8b1-4305-abe1-17b5085cd480
dcf76ec5-5b2f-40b7-8fbf-7a4a1b364cb7	ab6efbc0-103a-4c92-9823-37e84c71b245
f15303bd-3382-4133-98fe-29e62d00e173	ade63a46-d8b1-4305-abe1-17b5085cd480
054e4914-9812-40de-a922-730d778765a0	fd5a5fab-42a6-4f85-98f1-47a384c2c86e
7962a6f4-039f-4999-a200-54472b7e300e	b1ed2fe6-ace7-4807-ab32-4efae5010a61
7962a6f4-039f-4999-a200-54472b7e300e	96b31c95-7476-4f1b-8943-d87bb8049f94
6790bb98-60a3-462a-8ff3-07d9497c1c81	bc51f687-e4d7-4f99-9991-ac0384bb2122
6a40daeb-3a87-4617-be71-ef054ba439e5	d48a5292-64d8-498b-8232-9bb7e734f28c
6a40daeb-3a87-4617-be71-ef054ba439e5	bc51f687-e4d7-4f99-9991-ac0384bb2122
42dc9177-4665-4ebc-a849-5ec380176af2	ab6efbc0-103a-4c92-9823-37e84c71b245
42dc9177-4665-4ebc-a849-5ec380176af2	f2c9e628-b49f-423d-822a-f018830b7758
a0f76321-b6df-4604-bafd-8e4d2c126365	ab6efbc0-103a-4c92-9823-37e84c71b245
a0f76321-b6df-4604-bafd-8e4d2c126365	f2c9e628-b49f-423d-822a-f018830b7758
e15ca4a1-d4b8-4797-8498-3372b90e694d	982ddd9b-9381-4c89-a791-2945011c6245
1fc9d560-7608-495c-a0c5-1e77ac0e0161	fd461f11-c9ce-4f3c-be6a-cc82374644e7
03837c8b-fe29-4980-9758-3bade6557d1d	f2c9e628-b49f-423d-822a-f018830b7758
6728a2cf-dc65-43f7-ac16-6640d26c18c6	ab6efbc0-103a-4c92-9823-37e84c71b245
03837c8b-fe29-4980-9758-3bade6557d1d	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
cf570c1e-3fa1-455a-a1e5-155b93545ff5	ade63a46-d8b1-4305-abe1-17b5085cd480
cf570c1e-3fa1-455a-a1e5-155b93545ff5	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
62c31963-ed11-49a5-bd09-84e2d559347f	f2c9e628-b49f-423d-822a-f018830b7758
62c31963-ed11-49a5-bd09-84e2d559347f	ab6efbc0-103a-4c92-9823-37e84c71b245
788742eb-16e2-49ba-bb10-584116696fce	a8afc231-8f68-4281-960d-9a78f4e00d86
9ad89192-91c9-4c28-b3d5-af514524f51d	ade63a46-d8b1-4305-abe1-17b5085cd480
9ad89192-91c9-4c28-b3d5-af514524f51d	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
86910bc5-04aa-422c-9570-86b5138f408f	ade63a46-d8b1-4305-abe1-17b5085cd480
86910bc5-04aa-422c-9570-86b5138f408f	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
4b6b06e6-90be-4b2a-ac85-35a0018d28f0	ade63a46-d8b1-4305-abe1-17b5085cd480
4b6b06e6-90be-4b2a-ac85-35a0018d28f0	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
9b109105-d837-435b-8f97-58488f8d8420	ab6efbc0-103a-4c92-9823-37e84c71b245
9b109105-d837-435b-8f97-58488f8d8420	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
9b109105-d837-435b-8f97-58488f8d8420	a8afc231-8f68-4281-960d-9a78f4e00d86
9a5e5ea9-fb1f-4a1d-83a9-f1be0c5c7ea6	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
9a5e5ea9-fb1f-4a1d-83a9-f1be0c5c7ea6	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
f1b690f6-f428-4a43-9347-cbc25055d081	d73c59b5-e52b-45b5-9dc3-0ed9f1cff82b
f8f2624f-03a8-4ff5-9bf6-b104437712e5	ade63a46-d8b1-4305-abe1-17b5085cd480
f8f2624f-03a8-4ff5-9bf6-b104437712e5	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
f8f2624f-03a8-4ff5-9bf6-b104437712e5	a8afc231-8f68-4281-960d-9a78f4e00d86
2b02bf6d-0e18-419d-a8fc-02e31efac3e6	ab6efbc0-103a-4c92-9823-37e84c71b245
e661fb2f-ded1-4d83-9efd-9b85e680e77d	3f3edc5d-8fa6-4558-83db-46a690c0f30b
e661fb2f-ded1-4d83-9efd-9b85e680e77d	58d873e3-2b47-47a5-8b38-4fe48642aa22
2b02bf6d-0e18-419d-a8fc-02e31efac3e6	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
a2a8324a-9d26-48e3-bdf6-ddb7f958c6d8	9ccc168c-64b6-4939-852a-40786a963644
bb9c6562-0188-49c9-a37e-a796b31e3ccd	a8afc231-8f68-4281-960d-9a78f4e00d86
278c15b7-716d-4d30-8a4b-934e9a62fc68	d48a5292-64d8-498b-8232-9bb7e734f28c
278c15b7-716d-4d30-8a4b-934e9a62fc68	bc51f687-e4d7-4f99-9991-ac0384bb2122
bfe6239b-9f9d-44a3-800d-2b53dcb48730	10d5d5eb-c039-486d-902c-990e4c100175
bfe6239b-9f9d-44a3-800d-2b53dcb48730	d48a5292-64d8-498b-8232-9bb7e734f28c
bfe6239b-9f9d-44a3-800d-2b53dcb48730	bd532d08-9d2c-43e0-94c8-2f4a59343eea
2d02f0e6-8c45-4a40-af2c-fcbc2e48e097	fd461f11-c9ce-4f3c-be6a-cc82374644e7
2d02f0e6-8c45-4a40-af2c-fcbc2e48e097	58d873e3-2b47-47a5-8b38-4fe48642aa22
b769f760-b0fc-4cb1-9b55-edff7f712ed3	d48a5292-64d8-498b-8232-9bb7e734f28c
b769f760-b0fc-4cb1-9b55-edff7f712ed3	96b31c95-7476-4f1b-8943-d87bb8049f94
c936187d-7134-474a-b757-f30508552bab	c2f84619-71cb-4cee-84dc-07d914fec867
c936187d-7134-474a-b757-f30508552bab	b1ed2fe6-ace7-4807-ab32-4efae5010a61
7af7d4d3-6dc9-469b-bf78-ba0248352886	d48a5292-64d8-498b-8232-9bb7e734f28c
edb0d600-5792-4510-8d11-c705859a6b8d	d48a5292-64d8-498b-8232-9bb7e734f28c
64656846-2496-4ccc-a4eb-07de9ecc741d	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
64656846-2496-4ccc-a4eb-07de9ecc741d	a8afc231-8f68-4281-960d-9a78f4e00d86
fedbfc25-ecfe-4b78-b937-f7021f0b8b19	ade63a46-d8b1-4305-abe1-17b5085cd480
fedbfc25-ecfe-4b78-b937-f7021f0b8b19	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2184a222-13f1-4c4e-beb0-3bb0de9c8e5e	ade63a46-d8b1-4305-abe1-17b5085cd480
461f2687-e898-4694-bba7-c9f999c799ca	fd461f11-c9ce-4f3c-be6a-cc82374644e7
701b3be1-66c1-4076-9269-e148cb27ecec	f781607d-daa4-4134-bead-498e4afe70b0
2184a222-13f1-4c4e-beb0-3bb0de9c8e5e	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
2184a222-13f1-4c4e-beb0-3bb0de9c8e5e	a8afc231-8f68-4281-960d-9a78f4e00d86
32182e70-e6be-476d-8346-a2a264975809	c2f84619-71cb-4cee-84dc-07d914fec867
32182e70-e6be-476d-8346-a2a264975809	d48a5292-64d8-498b-8232-9bb7e734f28c
32182e70-e6be-476d-8346-a2a264975809	b1ed2fe6-ace7-4807-ab32-4efae5010a61
32182e70-e6be-476d-8346-a2a264975809	96b31c95-7476-4f1b-8943-d87bb8049f94
c35bdbd5-7efa-4424-8b9c-a3775dcf635d	ab6efbc0-103a-4c92-9823-37e84c71b245
c35bdbd5-7efa-4424-8b9c-a3775dcf635d	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
79cdc98e-3389-42e8-83a5-e2e5f272965c	d48a5292-64d8-498b-8232-9bb7e734f28c
d1ae9369-68d5-4f48-a161-de81b1601678	d48a5292-64d8-498b-8232-9bb7e734f28c
1dd77c46-5948-4c10-b375-bdeff1989e33	bd34fbf6-e632-482b-82e5-7e7640132996
121ade04-ad7a-4a95-957b-b616e8196214	d48a5292-64d8-498b-8232-9bb7e734f28c
c37f78d9-7e30-4132-920a-450ef1ad0acc	d48a5292-64d8-498b-8232-9bb7e734f28c
bbe4b9db-b105-4dd3-b377-8c607bc18475	d48a5292-64d8-498b-8232-9bb7e734f28c
db02c860-be0c-490b-b17e-19523beb7706	d48a5292-64d8-498b-8232-9bb7e734f28c
58da84d0-6da8-4ca0-84a5-a0a1336114f1	472dc2e7-8ec0-485c-ba5b-22cf3d3b776f
58da84d0-6da8-4ca0-84a5-a0a1336114f1	52cd3221-07e8-4192-9dbd-b1b2e21c5eb4
71f16280-ac65-4e2d-bba2-d1baefb4b68e	472dc2e7-8ec0-485c-ba5b-22cf3d3b776f
a03b72cc-701a-493e-9388-55bf273e8c69	b53921fb-36ac-475a-906a-bd401a5fe9f7
13fea73e-c6ed-4f7a-b0d5-2f16d2f97777	000f81d0-c696-4f6a-bdd9-1d14aac60b63
13fea73e-c6ed-4f7a-b0d5-2f16d2f97777	ac325118-570b-4ded-82bd-5270593e9b4c
183663ce-27f9-474d-b8ad-9b5641677b4b	13336f84-784f-4ce5-b372-88a3532f347d
183663ce-27f9-474d-b8ad-9b5641677b4b	0cc7829f-ca1e-49b9-9f45-d7481c14e28f
eda3e7da-33d6-4237-bd74-bd650c99679d	d48a5292-64d8-498b-8232-9bb7e734f28c
9780f1dc-e8d6-478c-a200-a99380d80794	d48a5292-64d8-498b-8232-9bb7e734f28c
760c4fcf-64d5-45c1-b0f7-79c70752f985	d48a5292-64d8-498b-8232-9bb7e734f28c
0b15953d-5417-4893-8bee-810bf784ee36	f2c9e628-b49f-423d-822a-f018830b7758
0b15953d-5417-4893-8bee-810bf784ee36	0cefdabd-3ceb-4f7c-a4b1-4e10ec47b73a
546da1a5-5003-4836-9812-a83c7a26d48c	9ccc168c-64b6-4939-852a-40786a963644
0173f94f-1112-4a79-88e7-71c50878f2ba	b53921fb-36ac-475a-906a-bd401a5fe9f7
8fabfc90-2185-4f3b-8c3e-639067420745	3ba94b77-1394-4f14-a71e-3e818232cf0d
0b15953d-5417-4893-8bee-810bf784ee36	a8afc231-8f68-4281-960d-9a78f4e00d86
50d7dca7-ec4c-418c-b5a1-c6e2dd9eb98a	982ddd9b-9381-4c89-a791-2945011c6245
50d7dca7-ec4c-418c-b5a1-c6e2dd9eb98a	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
67b1590f-b9f1-4937-ab6a-115cb2b7ac46	a8afc231-8f68-4281-960d-9a78f4e00d86
64ee5d57-f25d-4d1e-8cb1-c0394c9a9d03	d48a5292-64d8-498b-8232-9bb7e734f28c
64ee5d57-f25d-4d1e-8cb1-c0394c9a9d03	96b31c95-7476-4f1b-8943-d87bb8049f94
4a06de53-f7b3-463e-b332-4baff01fbfab	c22f5cb0-b61d-4d1a-9a7f-2b5ce908b6ed
cf833d72-2ca4-410d-98da-6e312a796cc6	fd461f11-c9ce-4f3c-be6a-cc82374644e7
cf833d72-2ca4-410d-98da-6e312a796cc6	0d463d97-e9fc-4a68-9cf7-e7d28d8a5e6e
49e05659-351d-4679-8e5e-c799effa723d	13336f84-784f-4ce5-b372-88a3532f347d
cf833d72-2ca4-410d-98da-6e312a796cc6	2691713c-d6a7-458c-a4a6-970deabec41c
8779326b-ba87-46ea-b186-8a9fc1ee1f0f	13336f84-784f-4ce5-b372-88a3532f347d
39407a63-2d4a-463e-a4fe-5f48cc68c933	d48a5292-64d8-498b-8232-9bb7e734f28c
39407a63-2d4a-463e-a4fe-5f48cc68c933	bc51f687-e4d7-4f99-9991-ac0384bb2122
8d8043f1-187f-42c6-b4db-c42995715767	ade63a46-d8b1-4305-abe1-17b5085cd480
8d8043f1-187f-42c6-b4db-c42995715767	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
c64e4b12-af42-4db1-82b1-910d1f8dbb56	ade63a46-d8b1-4305-abe1-17b5085cd480
c64e4b12-af42-4db1-82b1-910d1f8dbb56	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
659e1a7a-7fba-406d-8115-cddfbce3248e	a8afc231-8f68-4281-960d-9a78f4e00d86
659e1a7a-7fba-406d-8115-cddfbce3248e	f22f4178-a83e-41f9-a26a-d5941cd0e62d
c9c4104c-6569-49cb-8c14-8eaf3cf9c56c	ade63a46-d8b1-4305-abe1-17b5085cd480
c9c4104c-6569-49cb-8c14-8eaf3cf9c56c	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
cb6bd19a-afab-4a61-9c7e-1fa1f08d5b80	ade63a46-d8b1-4305-abe1-17b5085cd480
cb6bd19a-afab-4a61-9c7e-1fa1f08d5b80	a8afc231-8f68-4281-960d-9a78f4e00d86
10d1a7bd-9bf8-471b-b8a3-94b76a7ec7ad	ade63a46-d8b1-4305-abe1-17b5085cd480
10d1a7bd-9bf8-471b-b8a3-94b76a7ec7ad	72b24e3d-7b67-427d-b662-22eb594f478b
10d1a7bd-9bf8-471b-b8a3-94b76a7ec7ad	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
5ec7335d-1bec-4adf-b894-758fec8340ec	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
68a3f179-c6d1-4d41-a14d-0961a29c8410	ab6efbc0-103a-4c92-9823-37e84c71b245
68a3f179-c6d1-4d41-a14d-0961a29c8410	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
05126e22-e9e9-4807-b876-7c67f47af100	f2c9e628-b49f-423d-822a-f018830b7758
05126e22-e9e9-4807-b876-7c67f47af100	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
a5f85683-919d-4d5b-adec-557f03f77522	472dc2e7-8ec0-485c-ba5b-22cf3d3b776f
a5f85683-919d-4d5b-adec-557f03f77522	21152811-90c5-4b3e-a970-cceb922514e4
c5ac32e8-bd53-438d-9d94-10950af3336a	ade63a46-d8b1-4305-abe1-17b5085cd480
c5ac32e8-bd53-438d-9d94-10950af3336a	c098689c-5f8e-420b-8fc9-3cf3d255c9a9
c5ac32e8-bd53-438d-9d94-10950af3336a	f22f4178-a83e-41f9-a26a-d5941cd0e62d
1af6cd59-ddef-4e10-a513-892f5bc2bb4c	f22f4178-a83e-41f9-a26a-d5941cd0e62d
9a5e5ea9-fb1f-4a1d-83a9-f1be0c5c7ea6	a8afc231-8f68-4281-960d-9a78f4e00d86
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, user_id, title, notes, state, must_do_by, target_date, completed_at, is_deleted, created_at, updated_at, is_high_priority, board_id, links) FROM stdin;
f72e1e54-7764-447f-9268-43a4e1a58fd5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Grumpy- ask questions	\N	pending	\N	\N	\N	f	2026-06-28 14:01:16.327321+00	2026-06-28 14:03:44.630022+00	f	7cfdb07e-02e5-41f1-8924-9fbc300e940e	[]
c9b673fd-e4d5-42ef-8ae0-3f5f2a242d86	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Track User activity	Last login	pending	\N	\N	\N	f	2026-06-28 00:30:51.979751+00	2026-06-28 00:33:27.293521+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
faf9cf74-82fa-4b13-ab7d-46e8f6ee29cb	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Data cleanup - Anonymous users	\N	pending	\N	\N	\N	f	2026-06-28 00:30:32.515396+00	2026-06-28 00:33:57.948595+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
10d1a7bd-9bf8-471b-b8a3-94b76a7ec7ad	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Reimbursement- WFH	Remote Jan through June - ready to submit.\nNeed to submit K26 \nAlso submit for QCon	pending	\N	\N	\N	f	2026-06-15 23:06:49.067447+00	2026-07-12 22:44:49.553844+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
81a2dafc-3e0b-455f-af09-c2944f4d3adc	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Office	\N	pending	\N	2026-06-17	\N	t	2026-06-13 15:24:43.888629+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
b3249ffa-5ed7-4d60-86fe-68bffba82b9d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	New task - auto selection	\N	pending	\N	\N	\N	f	2026-06-28 00:39:39.296211+00	2026-06-28 00:39:39.296215+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
9a5e5ea9-fb1f-4a1d-83a9-f1be0c5c7ea6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	YMCA- Gym	\N	pending	\N	\N	\N	f	2026-06-12 01:45:10.470589+00	2026-07-12 22:46:20.470543+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
4c77b173-38bf-4590-8e5e-6a676c9348e9	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Order tasks	\N	pending	\N	\N	\N	f	2026-07-02 00:04:51.583605+00	2026-07-13 00:45:00.405097+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
a2bf5b77-30db-42f2-8685-fd85c4515928	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Native build reinstall	\N	pending	\N	\N	\N	f	2026-06-28 00:40:18.849905+00	2026-06-28 00:40:18.849909+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
9a43b66f-a581-459a-a4ce-7bc4b24f6c96	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Return cofee mugs	\N	pending	\N	2026-06-27	\N	t	2026-06-19 00:06:59.904155+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
f15303bd-3382-4133-98fe-29e62d00e173	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	car insurance - transfer	Check Mapfre	pending	\N	\N	\N	f	2026-06-18 21:06:52.402927+00	2026-07-07 22:49:34.098645+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
e9ce94d8-65a8-48cb-b252-fa54686571aa	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Election - registeration	\N	done	\N	2026-06-24	2026-06-24 15:52:30.85353+00	f	2026-06-18 12:03:55.435585+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
d7b59b0b-b011-4047-b458-00b80bd840ad	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Reports - across all boards	\N	pending	\N	\N	\N	f	2026-07-01 10:26:20.151908+00	2026-07-13 00:45:09.368894+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
5a20c6af-f247-43f5-9d40-451881ee61ad	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Cofee mugs	\N	done	\N	2026-06-27	2026-06-26 22:27:27.810477+00	f	2026-06-19 00:06:14.614728+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
054e4914-9812-40de-a922-730d778765a0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Hidden by default	\N	pending	\N	\N	\N	f	2026-06-28 01:08:18.490731+00	2026-06-28 01:08:18.490735+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
179bb6d0-ceda-4628-9aac-c257c3fd1083	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Loop engineering	https://addyosmani.com/blog/loop-engineering/	done	\N	2026-06-29	2026-06-30 10:30:52.154881+00	f	2026-06-28 18:25:13.938157+00	2026-06-30 10:30:52.154887+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
7962a6f4-039f-4999-a200-54472b7e300e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	MB- Mobile support	\N	done	\N	2026-06-28	2026-06-28 13:28:25.420482+00	f	2026-06-28 01:31:08.391113+00	2026-06-28 13:28:25.420489+00	t	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
104addcc-db03-4039-b9c2-6d855020c1dc	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Catch-up on LI saved posts	\N	pending	\N	\N	\N	t	2026-06-28 01:00:14.503871+00	2026-06-30 10:31:13.843321+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
f95245e6-6e0a-4d46-af4a-b96954ccb966	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup Android on laptop	\N	pending	\N	\N	\N	f	2026-06-28 00:29:32.266584+00	2026-06-28 21:54:50.942474+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
6e55587d-b8c4-4dd5-9692-271bc6e7ef1c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dis-allow duplicate receipts	\N	done	\N	2026-06-28	2026-06-29 00:40:29.712412+00	f	2026-06-28 01:09:02.147352+00	2026-06-29 00:40:29.71242+00	t	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
8139189a-8f56-4800-a905-e7b5f6b69563	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	display labels consistently	\N	pending	\N	\N	\N	t	2026-06-28 00:38:54.395672+00	2026-07-05 00:19:31.084142+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
64656846-2496-4ccc-a4eb-07de9ecc741d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Rav4	****\nReservation refund - Wellsley/Nathan \nReservation refund - Fasal/ Ira\nSticker refund- Fasal\nAmfam refund- Amfam	pending	\N	2026-07-20	\N	f	2026-06-25 00:09:55.159701+00	2026-07-12 22:43:38.581857+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
7094b3e9-04e4-421b-ad89-ef1899d5bbe0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Normalize settings.json	Move neutral to global	pending	\N	\N	\N	t	2026-07-01 23:37:12.353189+00	2026-07-02 00:05:44.231862+00	f	99ec8848-ad07-49f7-947d-ff3eb14871d8	[]
006aa9f8-3850-45ec-ade4-ff59622d2082	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Travel with mili	\N	done	\N	2026-07-02	2026-07-02 23:12:35.506405+00	f	2026-06-14 00:51:17.453223+00	2026-07-02 23:12:35.506411+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
b769f760-b0fc-4cb1-9b55-edff7f712ed3	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Add today's view	Configurable\nMultiple views	pending	\N	\N	\N	t	2026-07-01 10:27:31.61293+00	2026-07-02 10:29:51.547771+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
cf570c1e-3fa1-455a-a1e5-155b93545ff5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Medical expences-Kiddo	Opened case with navigaurd - D61691331404811\n"non emergency"\n\nD61691342380543 - two / one is processing/correction\n\nJuly 03:\nSent a message via navigaurd	pending	\N	2026-07-13	\N	f	2026-06-16 00:56:04.315635+00	2026-07-12 22:42:48.070341+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
1dd77c46-5948-4c10-b375-bdeff1989e33	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Remove Chat- UI	\N	done	\N	2026-07-02	2026-07-03 14:18:18.628163+00	f	2026-07-01 10:26:06.29251+00	2026-07-03 14:18:18.628169+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
0b473495-eac6-4d9f-9cad-75ca7877fef5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Drag-Drop tasks to upcoming	\N	pending	\N	\N	\N	t	2026-06-28 00:37:37.327689+00	2026-07-02 23:23:55.082683+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
ba09dda0-7f2c-41c0-a5c5-d7165d138f47	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Kiddo-prescription	HYD :\nBUP:\nAbilify :\nP :	pending	\N	2026-07-19	\N	f	2026-06-06 00:10:12.242975+00	2026-07-12 23:38:03.894851+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
edb0d600-5792-4510-8d11-c705859a6b8d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Work view	\N	pending	\N	\N	\N	t	2026-07-01 22:26:07.348676+00	2026-07-01 22:31:03.795563+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
21ff6342-63dc-4fbb-99aa-f2667b5a0fb9	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Order high priority tasks	\N	pending	\N	\N	\N	f	2026-06-28 00:38:16.383232+00	2026-06-28 00:38:16.383234+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
c936187d-7134-474a-b757-f30508552bab	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	MB-Focus View	Pr- 2 mobile remaining\nReview the data model	done	\N	2026-07-01	2026-07-02 00:03:18.568429+00	f	2026-06-28 00:31:21.261292+00	2026-07-02 00:03:18.568437+00	t	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
629dd23b-ec2c-4862-aa36-97080f584bbe	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Order tasks	\N	pending	\N	\N	\N	t	2026-06-28 00:37:13.090666+00	2026-07-02 15:19:03.908144+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
53de1415-89a8-4543-b82b-189dec53049a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Refactor project and imports	\N	pending	\N	\N	\N	f	2026-07-02 00:06:35.802777+00	2026-07-02 00:06:35.802782+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
a01f2181-5ccb-43a6-a629-6f64a66a82f8	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Increase Board limit to 10	Done. Need to verify	done	\N	2026-06-29	2026-06-30 10:21:56.822731+00	f	2026-06-28 14:25:45.08613+00	2026-06-30 10:21:56.822737+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
58da84d0-6da8-4ca0-84a5-a0a1336114f1	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Work trainings	Setup instance - On July 7th	done	\N	2026-07-07	2026-07-02 23:12:16.246904+00	f	2026-06-28 01:00:44.112303+00	2026-07-02 23:12:16.24691+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
ed578d51-2043-4179-b9ca-dd133580cb4b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Mobile native build	\N	pending	\N	\N	\N	f	2026-06-28 01:09:22.9711+00	2026-06-28 01:09:22.971103+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
9c0c0970-54d9-4a0a-91e1-6451f5fb13dc	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Android Build	\N	pending	\N	\N	\N	f	2026-06-28 01:09:36.94278+00	2026-06-28 01:09:36.942784+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
4a06de53-f7b3-463e-b332-4baff01fbfab	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	LinkedIn Post	candidates - 7 dwarfs	pending	\N	\N	\N	f	2026-06-28 00:59:59.590711+00	2026-07-04 23:49:22.829197+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
62c31963-ed11-49a5-bd09-84e2d559347f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dr Ly	FML follow-up	done	\N	2026-06-18	2026-06-18 15:44:26.695935+00	f	2026-06-14 00:50:37.103877+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
461f2687-e898-4694-bba7-c9f999c799ca	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Hello world OS	\N	done	\N	2026-07-02	2026-07-02 19:41:01.512348+00	f	2026-07-02 00:20:30.415516+00	2026-07-02 19:41:01.512354+00	t	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
a5f85683-919d-4d5b-adec-557f03f77522	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	InfoQ-Building GenAI Platform at DoorDash		pending	\N	\N	\N	f	2026-07-02 23:12:04.008167+00	2026-07-12 22:48:22.613959+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[{"id": "90daea55-5b69-4b11-b889-096c4670734a", "url": "https://boston.qcon.ai/presentation/boston2026/building-genai-platform-doordash", "description": "Building GenAI Platform at DoorDash"}]
097e0725-dd49-4ab9-a1af-dbb4172554d4	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Auto refresh	\N	pending	\N	\N	\N	f	2026-06-28 12:37:55.901603+00	2026-06-28 12:37:55.901606+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
81ca7734-dd07-4076-816e-4701afe80e3f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Mili expences update		pending	\N	2026-07-13	\N	f	2026-07-02 10:22:57.846352+00	2026-07-12 23:09:54.35205+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
1fc9d560-7608-495c-a0c5-1e77ac0e0161	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup meeting with Ben	\N	done	\N	2026-07-07	2026-07-07 20:04:42.75223+00	f	2026-07-02 10:46:04.107262+00	2026-07-07 20:04:42.752237+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
6876acb1-5877-41e9-a8dd-9a5a6018396c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Data model  design	\N	done	\N	2026-06-30	2026-07-01 10:23:56.012352+00	f	2026-06-30 10:24:25.885468+00	2026-07-01 10:23:56.012358+00	f	99ec8848-ad07-49f7-947d-ff3eb14871d8	[]
86910bc5-04aa-422c-9570-86b5138f408f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	FSA review	\N	pending	\N	\N	\N	f	2026-07-02 20:11:18.297762+00	2026-07-12 22:44:29.814268+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
b342a1ab-c5eb-45d5-a418-7245510885b9	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	LinkedIn comment	Interactive Resume	pending	\N	2026-07-13	\N	f	2026-06-28 01:02:57.959744+00	2026-07-12 22:48:16.709829+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
a2a8324a-9d26-48e3-bdf6-ddb7f958c6d8	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Mid-year review	Complete and Submit\nGriffin not to Jack	done	2026-07-13	2026-07-13	2026-07-13 20:04:24.560743+00	f	2026-07-01 15:22:28.729022+00	2026-07-13 20:04:24.560748+00	t	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "10f2552e-c717-4826-a589-43613e09a176", "url": "https://surf.servicenow.com/esc", "description": "Surf"}]
0173f94f-1112-4a79-88e7-71c50878f2ba	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Agent-skills		pending	\N	\N	\N	f	2026-06-28 18:31:12.554454+00	2026-07-04 14:08:28.787698+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[{"id": "3ec65880-fa9f-4a39-8a87-eaad88c524c0", "url": "https://github.com/addyosmani/agent-skills", "description": "github"}]
c37f78d9-7e30-4132-920a-450ef1ad0acc	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Change header	My tasks => Board name	done	\N	2026-07-02	2026-07-03 14:18:06.982529+00	f	2026-07-02 10:36:56.263817+00	2026-07-03 14:18:06.982538+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
79cdc98e-3389-42e8-83a5-e2e5f272965c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Tasks limit	Restrict to one board.	pending	\N	\N	\N	f	2026-06-28 01:04:55.154602+00	2026-07-02 23:05:09.041333+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
701b3be1-66c1-4076-9269-e148cb27ecec	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup SHP locally	\N	pending	\N	\N	\N	f	2026-07-02 00:20:41.551853+00	2026-07-02 20:06:46.910648+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
7f886bdf-add2-419f-b0ec-78f105d682df	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup Playwrite	\N	pending	\N	\N	\N	f	2026-07-03 15:27:46.03324+00	2026-07-13 00:45:05.029921+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
eda3e7da-33d6-4237-bd74-bd650c99679d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Board tabs- positioning	Make them right aligned	done	\N	2026-07-03	2026-07-03 16:40:50.414673+00	f	2026-07-03 14:19:22.578388+00	2026-07-03 16:40:50.414678+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
0b078bce-c128-43ef-8e5a-070b643f5db1	2462518d-29f4-46a3-9cfe-116aece78b5e	rrr	\N	pending	\N	\N	\N	t	2026-07-03 23:23:17.009304+00	2026-07-03 23:23:22.545975+00	f	15507f5c-eccd-4edf-8edd-aead7588c787	[]
2b02bf6d-0e18-419d-a8fc-02e31efac3e6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Apply-Massability	https://www.mass.gov/info-details/apply-for-services\n\n******Resume\nAny Medical or mental health documentation\nHealth Insurance Documentation\nEducation documentation (Individual Education Plan -IEP or any educational assessments/evaluations)\nPersonal Care Assistance documentation\nAny documentation related to public benefits\nAnd more!	pending	\N	\N	\N	f	2026-06-12 02:05:30.249941+00	2026-07-12 22:47:15.48731+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
f1b690f6-f428-4a43-9347-cbc25055d081	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Multi-Agent setup	setup cred in  ~/.ldap_credential.yaml\nRun setup again\nAnd then try something	pending	\N	2026-07-14	\N	f	2026-07-02 10:46:54.45601+00	2026-07-13 20:04:41.90772+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
68a3f179-c6d1-4d41-a14d-0961a29c8410	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Apply - MassHealth	https://www.mahix.org/individual/account/dashboard	pending	\N	\N	\N	f	2026-06-12 22:12:38.317503+00	2026-07-12 22:45:17.759012+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
49888de1-cddf-4da8-b71a-feed2b2ef87e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Android release	\N	pending	\N	\N	\N	f	2026-06-28 00:40:00.646188+00	2026-06-28 00:40:00.64619+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
a12daf8f-cfe4-4157-8c8e-340df9c72b3f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Grocery List  improvements	Dont duplicate items\nChange the view completely	pending	\N	\N	\N	f	2026-06-28 01:07:06.894497+00	2026-06-28 01:08:33.825701+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
1b3af298-2b55-4ca7-a0cb-58af771ddd81	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Remove Railway	\N	pending	\N	\N	\N	f	2026-07-02 00:53:32.575112+00	2026-07-02 00:53:32.575117+00	f	99ec8848-ad07-49f7-947d-ff3eb14871d8	[]
ecbd6602-1919-4eae-ad7f-c30d5c804bf0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Create Data Model	\N	pending	\N	\N	\N	f	2026-07-02 00:54:15.21772+00	2026-07-02 00:54:15.217723+00	f	99ec8848-ad07-49f7-947d-ff3eb14871d8	[]
32182e70-e6be-476d-8346-a2a264975809	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Links to Tasks	Next - Full review	done	\N	2026-07-02	2026-07-02 16:32:13.637461+00	f	2026-06-28 00:36:06.904381+00	2026-07-02 16:32:13.637468+00	t	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
26474cf1-142d-444c-ac14-1ea8bbbdfd2a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Performance and volume testing	Spoke to Usha\nFollowup next week	pending	\N	2026-07-14	\N	f	2026-07-02 00:20:53.18722+00	2026-07-09 23:43:56.628578+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
22dab36d-3e6a-4d36-b97d-3768cd5016d5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Remove Show Done	\N	done	\N	2026-07-02	2026-07-03 14:18:09.799204+00	f	2026-07-02 10:34:30.730598+00	2026-07-03 14:18:09.79921+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
77f84b8e-832a-4785-8aad-9a12974f6d4a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Workflow Execution review- Merge	\N	done	\N	2026-07-02	2026-07-02 20:06:16.431464+00	f	2026-07-02 00:21:11.185928+00	2026-07-02 20:06:16.431471+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
121ade04-ad7a-4a95-957b-b616e8196214	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Left Nav - move next to views	\N	done	\N	2026-07-02	2026-07-03 14:18:12.775527+00	f	2026-07-02 10:31:26.988763+00	2026-07-03 14:18:12.775531+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
b3b4b7c0-afe3-43db-9ea3-58e9f9b0e1e9	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Agentic flow	Update Claude.md from tasksAreUs\nLocal settings	pending	\N	\N	\N	f	2026-06-30 10:25:08.366376+00	2026-07-02 10:25:22.232995+00	f	99ec8848-ad07-49f7-947d-ff3eb14871d8	[]
7af7d4d3-6dc9-469b-bf78-ba0248352886	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Move tasks from one board to another	\N	done	\N	2026-07-02	2026-07-03 14:18:15.260344+00	f	2026-07-01 15:24:08.864224+00	2026-07-03 14:18:15.260349+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
49e05659-351d-4679-8e5e-c799effa723d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Workflow Review- Drain	\N	done	\N	2026-07-06	2026-07-06 18:17:59.999812+00	f	2026-07-02 23:06:41.983036+00	2026-07-06 18:17:59.999816+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
760c4fcf-64d5-45c1-b0f7-79c70752f985	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Sticky Boards and view	If I navigate out  to reports, settings , task details, when I come back I want the same view and board selected	done	\N	2026-07-03	2026-07-03 16:40:47.495922+00	f	2026-07-03 14:45:11.388419+00	2026-07-03 16:40:47.495929+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
71f16280-ac65-4e2d-bba2-d1baefb4b68e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Info Q - find the stuff	https://boston.qcon.ai/schedule/boston2026	done	\N	2026-07-06	2026-07-02 23:12:12.594027+00	f	2026-06-28 01:01:26.726226+00	2026-07-02 23:12:12.594032+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[{"id": "126737fa-a784-486b-95f9-5c363a532d7e", "url": "https://boston.qcon.ai/schedule/boston2026", "description": "InfoQ sessions"}]
9780f1dc-e8d6-478c-a200-a99380d80794	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Task details	Labels appear twice in task details. Remove the read-only ones\nMove the Add Link right below notes\nMake the Notes section bigger	done	\N	2026-07-03	2026-07-03 16:40:48.802442+00	f	2026-07-03 14:20:50.539318+00	2026-07-03 16:40:48.802446+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
89b4f500-e31e-472f-9394-bd4cd1b72c39	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Bigger notes in tasks	\N	pending	\N	2026-07-03	\N	t	2026-06-28 00:36:26.647216+00	2026-07-03 14:43:08.835709+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
bbe4b9db-b105-4dd3-b377-8c607bc18475	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Settings- across all boards	\N	done	\N	2026-07-03	2026-07-03 16:40:51.932034+00	f	2026-07-02 10:38:23.89544+00	2026-07-03 16:40:51.932039+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
1cbbdff0-61e5-4f8a-8fca-74dfd489fa41	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	New views- parity with All	make them exactly the same as All view	done	\N	2026-07-04	2026-07-04 14:08:51.395624+00	f	2026-07-03 14:50:25.177286+00	2026-07-04 14:08:51.395631+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
ed9fef66-82a7-4449-aafa-734c47aab96e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Empty/Clean car		done	2026-07-05	\N	2026-07-06 02:26:39.868021+00	f	2026-07-04 18:34:12.949719+00	2026-07-06 02:26:39.868027+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
a03b72cc-701a-493e-9388-55bf273e8c69	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Superpowers	https://github.com/obra/superpowers	pending	\N	\N	\N	f	2026-06-28 18:30:20.704458+00	2026-07-02 15:42:59.74759+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[{"id": "5fa898fb-715f-4f73-a972-df123ac25a31", "url": "https://github.com/obra/superpowers", "description": "Github"}]
b17ba55c-2233-48c3-a324-181dd7121c07	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	401K- Review	June 19th \nMy contribution : 14,090.68\nemployer : 3,785.57\nPay stub : 1,321.00\n12 %\nChanged to 13 %\nLimit: 32,500	pending	\N	2026-07-17	\N	f	2026-05-26 21:30:47.455815+00	2026-07-13 20:10:25.645113+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
9b109105-d837-435b-8f97-58488f8d8420	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Explore -2026 Options(Kiddo)	https://docs.google.com/document/d/19cZbbhAqGaYNT5ixRE0qb1k4IyAWmW4nZIXZDK8306A/edit?usp=sharing	pending	\N	\N	\N	f	2026-06-12 02:24:32.411146+00	2026-07-12 22:45:33.020273+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
db02c860-be0c-490b-b17e-19523beb7706	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Search - across all boards	\N	pending	\N	\N	\N	t	2026-07-02 10:45:13.093774+00	2026-07-04 11:37:55.119735+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
bddd54ed-90bd-46db-a727-addd06a39115	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Edit details- bug	wont save	done	\N	2026-07-04	2026-07-04 14:08:54.862725+00	f	2026-07-04 00:37:55.777879+00	2026-07-04 14:08:54.86273+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
2ecf0a02-81ab-4e1e-86a8-ba54987e9fef	2afec1e2-ebe6-4494-aeba-18a3268d22eb	MeetCatherine		pending	2026-07-06	\N	\N	f	2026-07-04 17:16:48.292301+00	2026-07-04 17:18:47.644756+00	f	1e025383-0008-4474-acf8-7ea37b342866	[]
8fabfc90-2185-4f3b-8c3e-639067420745	2afec1e2-ebe6-4494-aeba-18a3268d22eb	Discuss with Kenny		pending	2026-07-10	2026-07-08	\N	f	2026-07-04 17:19:47.827863+00	2026-07-04 17:19:47.827869+00	f	1e025383-0008-4474-acf8-7ea37b342866	[]
b7a0ffe4-b777-4405-8005-04b9557098c6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Mobile -Catch-up	development-plans/PLAN-feat-tasks-view-redesign-mobile.md\n\nCoding done.\nFull review next- 46	done	\N	2026-07-07	2026-07-08 11:28:34.416834+00	f	2026-07-03 15:29:53.107626+00	2026-07-08 11:28:34.41684+00	t	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
6a40daeb-3a87-4617-be71-ef054ba439e5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Boards - color cordination	\N	pending	\N	\N	\N	f	2026-07-03 15:30:40.420862+00	2026-07-12 21:37:58.518603+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
d974f067-a8bd-46ac-9d82-56653930e12a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Salary-Review	June 30th\n401K : 1321 / hasnt changed	pending	\N	2026-07-15	\N	f	2026-05-26 21:30:47.455815+00	2026-07-13 20:10:15.230376+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
950ef5b1-1659-487d-b54b-9edd3c7f5d13	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Meds- kiddo	\N	done	\N	2026-06-23	2026-06-24 00:43:18.262633+00	f	2026-06-23 23:54:59.897877+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
bfcbe850-c2d1-49c6-9a0b-29053b9ddf8c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	HSA-Transfer	\N	pending	\N	\N	\N	t	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
77a98ab3-51bb-48c5-8c6c-0a19d985db2d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Poop test	\N	done	\N	2026-06-22	2026-06-22 16:34:06.039897+00	f	2026-06-13 12:28:48.201743+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
dcf76ec5-5b2f-40b7-8fbf-7a4a1b364cb7	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Uber-Review	\N	pending	\N	\N	\N	t	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
eb752fbc-b32e-4317-a8c3-328c45e467bf	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	ccae-animal class	https://ccae.org/classes/offering/1373/animal-illustration-in-person	done	\N	2026-06-18	2026-06-18 14:55:57.10271+00	f	2026-06-18 13:56:34.601618+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
03837c8b-fe29-4980-9758-3bade6557d1d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	My support	https://bpdalliance.org/family-connections/	done	\N	2026-06-18	2026-06-18 18:05:06.013302+00	f	2026-06-06 14:05:57.155377+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
e0c308b5-df46-4a65-b560-f4b30a225c7c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Return-Kohls	\N	done	\N	2026-06-03	2026-06-03 21:16:30.431035+00	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
cc5ce0fe-ad16-48ae-8457-10940988a88a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Disability Services-Followup	\N	pending	\N	2026-06-08	\N	t	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
231e65b5-33f0-4006-ad17-265c50231c24	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Renew-Driving License	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
697d9942-a683-48f3-9dd2-7e7f5372d5bf	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dismantle-Christmas tree	\N	done	\N	\N	2026-05-30 13:44:02.154142+00	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
5dc8005a-56f7-4463-99e1-a661c7ed4576	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	kiddo-bunkerhill	\N	done	\N	2026-05-30	2026-06-02 20:42:40.017398+00	f	2026-05-30 13:46:10.747862+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
1f3e63fd-6f97-4110-8ef1-9ccbb0eecbb3	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup-Speakers	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
16b3ef7b-28ad-4eda-9fcd-ba1990bc9cff	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Return-Costco	toilet paper\ndetergent\nunderwear\nshorts\nMop\nChairs	done	\N	2026-06-04	2026-06-04 17:22:00.948399+00	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
a0f76321-b6df-4604-bafd-8e4d2c126365	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dental-schedule (kiddo)	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
17f06f95-d928-44db-800f-fddb968396db	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dr Luy	FML; Mental Health Services ; able account \nemail comm ?\nFatigue ; fear ; how much to push ? mania ? side-effects\nMarijuana ; BUP	done	\N	2026-06-04	2026-06-04 17:20:41.799006+00	f	2026-06-02 23:48:42.353973+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
1a3945c0-7f19-4a0f-9c42-2294633f6c37	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Kiddo-Discontinue-Pearson	\N	pending	\N	2026-06-12	\N	t	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
b2a6e239-517b-407f-a581-9fdc54c370b0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Work-Expense Report	Add Q Ccon to personal	pending	\N	2026-07-14	\N	f	2026-05-26 21:30:47.455815+00	2026-07-13 19:03:15.461684+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
4f8eb8fc-0862-4463-b505-d6b7f7034e7a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Laundry	Refill	pending	\N	2026-07-14	\N	f	2026-06-14 01:58:33.500163+00	2026-07-13 20:10:43.690956+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
c5ac32e8-bd53-438d-9d94-10950af3336a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Change beneficiary	DCU\nCapital One\nFidelity\nM1\nFundrise\nWork	pending	\N	\N	\N	f	2026-06-02 23:29:50.460964+00	2026-07-12 22:45:57.281531+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
5ec7335d-1bec-4adf-b894-758fec8340ec	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Hostgator	https://www.hostgator.com/help/article/how-to-navigate-through-file-manager\n\nAccess CPanel\nTrash stuff\nCheck srijanarts and gopikaluthra\nTake backup\nFind a new hosting	pending	\N	\N	\N	f	2026-06-14 17:53:04.939686+00	2026-07-12 22:45:03.505942+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
829c0b4c-96d6-40df-a18e-341edd39291a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Costcco-Recliner	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:47:54.125471+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
05126e22-e9e9-4807-b876-7c67f47af100	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Cannabis renewal	\N	pending	\N	\N	\N	f	2026-06-12 20:20:05.680377+00	2026-07-12 22:45:24.239427+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
98a33250-ae4a-4990-a3a0-b6d3977c3fff	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	kiddo-northshore	Followup on fees	pending	\N	2026-07-15	\N	f	2026-05-30 13:46:48.53587+00	2026-07-12 23:23:18.470718+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
c64e4b12-af42-4db1-82b1-910d1f8dbb56	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	SNOW-RSU	\N	pending	\N	2026-07-18	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:43:13.094952+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
8d8043f1-187f-42c6-b4db-c42995715767	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Pay bills	Raghav Urgent care - ?	pending	\N	2026-07-17	\N	f	2026-06-12 22:27:09.433871+00	2026-07-12 22:43:05.314569+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
9ad89192-91c9-4c28-b3d5-af514524f51d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Review and withdrawl 529	Confirm deposit\nAdjust rocketmoney	pending	\N	2026-07-31	\N	f	2026-06-12 01:58:49.843589+00	2026-07-12 22:44:02.828693+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
c9c4104c-6569-49cb-8c14-8eaf3cf9c56c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	IRA-Review	2026 - hit the limit	pending	\N	2026-12-26	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:44:23.432465+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
cb6bd19a-afab-4a61-9c7e-1fa1f08d5b80	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Amazon returns- lost	\N	pending	\N	\N	\N	f	2026-06-18 12:04:21.128738+00	2026-07-12 22:44:43.536565+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
1af6cd59-ddef-4e10-a513-892f5bc2bb4c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Setup-Ear pods	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:46:02.586129+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
4c7b5aff-1ba3-469d-b4a3-bee3903f456e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Able account	Open Able account\nRollover from 529 to Able	pending	\N	\N	\N	f	2026-06-02 20:42:25.255208+00	2026-07-12 22:46:28.843325+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
de141805-1d65-4722-8b2b-26a8e196b2f7	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Schedule-Colonoscopy	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:46:37.789173+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
022b4a22-2f41-4f80-b848-6da6fb1d4cea	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Apply-Dept Mental health Services	\N	pending	\N	\N	\N	f	2026-06-12 02:05:51.537899+00	2026-07-12 22:47:09.979861+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
50d7dca7-ec4c-418c-b5a1-c6e2dd9eb98a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Filter change	\N	pending	\N	\N	\N	f	2026-06-03 12:22:51.232018+00	2026-07-12 22:47:21.285907+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
ec9a4b24-858b-4fa7-aa4d-d3db619a3d37	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Financial recording and analysis- Rocket , Uber, Kiddo	Mystic - scheduled ; followup with ass\nLas Vegas\nHospitalization\nCostco - 05/03\nWegmans\nRaghav ?\nUber	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:47:58.999254+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
42dc9177-4665-4ebc-a849-5ec380176af2	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Mental Health Services	\N	pending	\N	\N	\N	t	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
6728a2cf-dc65-43f7-ac16-6640d26c18c6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	kiddo-drawing	\N	pending	\N	2026-06-06	\N	t	2026-06-03 02:17:22.556962+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
7b492ad1-a4eb-4d0e-b1e9-6584eda4f51f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Github- renew PAT	Decided to ignore	done	\N	2026-06-14	2026-06-14 17:25:41.306365+00	f	2026-06-12 22:25:04.593116+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
b269ff92-23ea-4124-a20a-2bee9bccf666	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Costco	\N	done	\N	2026-06-21	2026-06-20 21:17:20.509026+00	f	2026-06-13 15:22:16.718486+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
ca07ba20-a6d7-4e2a-8dda-20d7ed436a47	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Explore - DDS options	\N	pending	\N	2026-06-12	\N	t	2026-06-03 01:16:52.820924+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
fa36cccd-ab1d-44b8-b46a-a5bc0143e4aa	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Blood work-followup	Put the date on calendar	done	\N	2026-06-18	2026-06-18 18:06:47.466973+00	f	2026-05-26 21:30:47.455815+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
fccc2015-c6a1-4d31-8b62-9f6e84f141a0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Update Kurt	Update OOO	pending	\N	2026-06-22	\N	t	2026-06-12 22:33:18.31486+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
2151d91f-3441-439d-a156-d01407d6eee6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Ellison	FML; Mental Health Services ; able account	pending	\N	2026-06-22	\N	t	2026-06-03 00:33:49.043412+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
2fa73292-8284-490d-9753-1a75ac8a0f4c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Godaddy	Gopika luthra - Oct 5th\nSrijanarts- Mar 14th	pending	2026-10-05	2026-08-31	\N	f	2026-06-24 23:37:01.061514+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
1faed392-329d-4dc1-91db-7cf0aec4193b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Car Sticker	\N	done	\N	2026-06-25	2026-06-25 15:03:34.775712+00	f	2026-06-02 23:46:26.35057+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
5bea8d2a-31c2-435c-8a93-1406f0df48d6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Vape pen	\N	done	\N	2026-06-18	2026-06-19 01:13:53.096016+00	f	2026-06-19 00:06:34.396439+00	2026-06-27 21:59:04.274096+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
0fa0ad05-d4ab-49de-a7a5-9bc14318339e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Sara - Advanced Therapy Center	Sensitivity to noise\nPatience\nLethargy\ni am disabled.\nExecutive functioning	done	\N	2026-06-19	2026-06-19 11:09:50.041355+00	f	2026-06-18 12:00:44.442216+00	2026-06-27 21:59:04.274096+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
8f4ba6bf-4af4-4a8a-ab8d-b069ff14d56d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Review features	Power user ?\nTiered users ?\nHow is cost tracking being done ?\nDelete images ?Scheduled job ? disable ?\nComparing the items in list and reciepts \nRe-do all the beliefs ?	pending	\N	\N	\N	f	2026-06-28 13:48:20.135359+00	2026-06-28 13:50:28.663825+00	f	c9dfea64-d65e-4b69-aa3a-3959c824fbc1	[]
67b1590f-b9f1-4937-ab6a-115cb2b7ac46	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Swimming - YMCA	Next session is on July 19th.	pending	\N	2026-07-20	\N	f	2026-06-12 01:42:44.675648+00	2026-07-13 20:11:52.667019+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
e15ca4a1-d4b8-4797-8498-3372b90e694d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Printer - fix		pending	\N	\N	\N	f	2026-06-27 12:38:43.02657+00	2026-07-06 11:53:45.520697+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
4b6b06e6-90be-4b2a-ac85-35a0018d28f0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	cancel-Dropbox subscription	\N	pending	\N	\N	\N	f	2026-06-14 18:51:27.338953+00	2026-07-12 22:44:57.10261+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
8c63a567-38ac-44ce-a5c2-07c5b9c79926	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Disability services-Followup	https://docs.google.com/document/d/1rl22627hHWgXUszF10xV9tm6KF3_kXpWGPPVC6oSo2o/edit?usp=sharing	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 23:00:47.499246+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
d1ae9369-68d5-4f48-a161-de81b1601678	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Multiple views	Support multiple views\n1) Focussed\n2) Detailed\n3) Today	done	\N	2026-07-02	2026-07-03 14:18:17.693911+00	f	2026-07-01 10:29:03.949381+00	2026-07-03 14:18:17.693917+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
39407a63-2d4a-463e-a4fe-5f48cc68c933	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Order boards	define the order	pending	\N	\N	\N	f	2026-07-01 15:23:48.157417+00	2026-07-13 00:44:56.035477+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
0b15953d-5417-4893-8bee-810bf784ee36	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Schedule-Dental hole	\N	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:46:55.876012+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
6cd210a4-a9bb-419c-8384-4118c9f0d577	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Google voice- 978 710 0119	use or lose	pending	2026-07-18	2026-07-13	\N	f	2026-06-12 22:25:54.798264+00	2026-07-12 23:10:29.219347+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
f8f2624f-03a8-4ff5-9bf6-b104437712e5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	HSA-Review	Transfer from Optum\n\nJune 25th\n\nAmount contributed $8,500.00\nEmployer contribution $2,000.00\nYour contribution $6,500.00\nFamily limit $8,750.00\nAmount left $250.00	pending	\N	\N	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:46:49.119024+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
659e1a7a-7fba-406d-8115-cddfbce3248e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Haircut	\N	pending	\N	2026-07-25	\N	f	2026-06-19 14:49:14.77429+00	2026-07-12 22:43:50.002318+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
9913efe6-c9b4-47a9-8d73-130b3c379bb5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	kiddo-dietician		pending	\N	2026-07-13	\N	f	2026-06-03 02:16:54.853404+00	2026-07-12 23:32:23.587874+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
e1e40091-a95e-4bf7-a11a-98457263dc3c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Cancel-Pearson		pending	\N	2026-07-13	\N	f	2026-06-02 20:43:01.903931+00	2026-07-12 23:23:51.708155+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
788742eb-16e2-49ba-bb10-584116696fce	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Maria		pending	\N	2026-07-19	\N	f	2026-06-19 01:24:48.798413+00	2026-07-12 22:43:30.001118+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
2184a222-13f1-4c4e-beb0-3bb0de9c8e5e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Review Car insurance	Dec 20th - next auto payment	pending	2026-12-20	2026-12-01	\N	f	2026-06-13 20:52:10.58121+00	2026-07-12 22:44:17.52947+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
d9f52515-982c-4052-a311-365de4747967	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Water plant		pending	\N	2026-07-15	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 23:14:03.82571+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
7b19958f-30a2-4028-9ef3-88e2c31aaefb	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	CHAMP- Residence program	\N	pending	\N	\N	\N	f	2026-06-12 02:06:15.957621+00	2026-07-12 22:47:03.911018+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
dd2a5787-90c8-43e1-a8aa-4aaed230cb88	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	kiddo-yoga	\N	pending	\N	\N	\N	f	2026-06-03 02:17:43.584723+00	2026-07-12 22:47:27.474124+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
525aeb1b-f6c1-4333-a6a5-fc0c318de35a	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Dis-invest M1 account (Kiddo)	WellsFargo- download statement\nRemove Medical and education\nRest - pay from M1	pending	\N	\N	\N	f	2026-06-02 21:57:36.991471+00	2026-07-12 22:47:33.191768+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
1406ed9f-6cbb-4ad8-89b7-9353463b9595	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Medical reimbursement-Vivian		pending	\N	2026-08-01	\N	t	2026-05-26 21:30:47.455815+00	2026-07-04 21:42:53.405456+00	f	67b3275c-945c-4014-81d3-a2235118d527	[{"id": "2e7de77e-809b-47ed-be5c-12b9f74d69d4", "url": "https://docs.google.com/spreadsheets/d/1bTKvwreq51kv1tlhy8yBC1MSCoukUoYEE00YnEQ8rJc/edit?usp=sharing", "description": "Tracker"}]
861bdbea-71be-43df-8522-a57d6507d715	2afec1e2-ebe6-4494-aeba-18a3268d22eb	Direct Deposit Change		pending	\N	2026-07-04	\N	f	2026-07-04 17:21:05.21697+00	2026-07-04 17:22:20.471675+00	t	db447117-683e-4d3d-8da4-0a3bc0cdd0ad	[]
c98e9d10-f400-4eca-ac35-ed1fbfc0a41c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS BOT Py - review		done	\N	2026-07-07	2026-07-07 19:44:40.833033+00	f	2026-07-07 12:18:25.858856+00	2026-07-07 19:44:40.833039+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
cb33d643-bb80-4faf-8e3c-c10e5f80d902	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Learn Open-Weights		pending	\N	\N	\N	f	2026-07-04 19:42:34.171022+00	2026-07-04 20:23:01.372492+00	f	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
183663ce-27f9-474d-b8ad-9b5641677b4b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS-IA Workflow review- Move		pending	\N	2026-07-14	\N	f	2026-07-06 18:19:51.034047+00	2026-07-13 20:04:50.432637+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "5c7d5f8d-b5bb-4395-82c0-143d4bc39791", "url": "https://code.devsnc.com/pages/aisearch/multi-agant-case-triage/ais-ia-workflow-reliability.html", "description": "Report"}]
64ee5d57-f25d-4d1e-8cb1-c0394c9a9d03	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Tags- Create from Task Details		pending	\N	\N	\N	t	2026-07-04 19:43:07.223268+00	2026-07-04 23:18:32.590812+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
6790bb98-60a3-462a-8ff3-07d9497c1c81	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	New view - Overdue	A new view to be created- Overdue.\nThis will be designed similar to Focussed.\nIts criteria is - when dude date is in the past (target or must d o by)\n\nThe tab will show to the right of Focussed.\nIf there are overdue tasks, this will be the default view otherwise Focussed	pending	\N	\N	\N	f	2026-07-04 21:46:01.627111+00	2026-07-12 21:37:18.296736+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
6f8a7ae8-22a0-416e-8c97-7c91d6727fbf	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Edit Task- links management	If there are 0 links,  Keep one set of description/link text field visible to be filled in. \nFor saved and un-saved links, show an icon to the right of the box which will open in a new tab	pending	\N	2026-07-13	\N	f	2026-07-04 23:13:13.641146+00	2026-07-13 00:44:14.216422+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
864eac80-ab82-476f-ad24-07fd7c6eef3f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Amazon returns- Soundcore	Wholefoods	done	\N	2026-07-06	2026-07-06 14:08:53.080661+00	f	2026-07-06 11:58:28.542299+00	2026-07-06 14:08:53.080668+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
8c72ca3d-2c6e-42ff-9fe4-3289c3cabb32	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Type = Tags	1) Call them Tags\n2) No more type and mode. Delete all the modes.\n3) On the UI - Right align display\n4) Order in terms of number of tasks on the board. The tag with most tasks is left most\n5) Can add Tags directly from Edit/Add Task page\n6) On Task card - show Tags in alphabetic order\n7) Settings page - Show in alphabetic order\n8) Data cleanup in Railway. Okay to delete modes	pending	\N	2026-07-13	\N	f	2026-06-28 00:35:22.801281+00	2026-07-13 00:44:22.572159+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
bfe6239b-9f9d-44a3-800d-2b53dcb48730	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Add Task	Not working from an alternate board\nChange board - should refresh the labels \nThe board is sticky to where it came from\nLabels - same experience as Edit Task	done	\N	2026-07-08	2026-07-12 21:37:34.011274+00	f	2026-07-04 18:48:18.089585+00	2026-07-12 21:37:34.011279+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
278c15b7-716d-4d30-8a4b-934e9a62fc68	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	New task display	If the board has a no tasks, the New task button should be in the middle of the grid\n\nRename from + to "New Task"	pending	\N	\N	\N	f	2026-07-04 18:47:10.248863+00	2026-07-12 21:37:49.482379+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
546da1a5-5003-4836-9812-a83c7a26d48c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Concur expenses	Remote and oop	pending	\N	2026-07-16	\N	f	2026-07-06 14:17:05.945591+00	2026-07-07 21:54:37.019159+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
e661fb2f-ded1-4d83-9efd-9b85e680e77d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS backup - review	Following up with Rob S on contractual stuff\n\nReview tickets if we have the go-ahead : Griffin	pending	\N	2026-07-14	\N	f	2026-07-07 12:42:02.995014+00	2026-07-13 20:04:57.158955+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
403d081e-9c7d-48c1-bba9-d749bbcc504c	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Job referral - Kamal		done	\N	2026-07-08	2026-07-08 11:16:19.057562+00	f	2026-07-07 00:21:15.670227+00	2026-07-08 11:16:19.05757+00	t	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
92d78fb6-12f9-42db-903e-f9b698b9bbff	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Laptop Setup	Outlook\nGitlab\nPrinter	pending	\N	2026-07-14	\N	f	2026-07-06 16:43:13.02666+00	2026-07-13 19:03:30.237484+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
8b6a8179-4d4e-4efd-b826-3581a7fc12e5	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Check-in with Sara/ Riley		pending	\N	2026-07-17	\N	f	2026-07-04 23:29:43.977633+00	2026-07-13 20:14:55.565919+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
bb9c6562-0188-49c9-a37e-a796b31e3ccd	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Demand notice	Call Town\nCall Mortgage\n\nBill date :05/13/2026\nBill number : 213532\nPast due : 1206.23\nInterest : 14.80\nDemand : 10\nTOTAL : 1231.03\n\nMailed Date 2026-05-27 Check# 413696971 Check Amount 1231.03\nShipped via US P OSTAL Priority (2-3 days) Tracking ID\n9405540109627034158085	pending	\N	2026-07-13	\N	f	2026-07-04 23:07:26.649944+00	2026-07-13 20:46:04.676582+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
b08b9632-d110-4931-9586-daef3bf6086b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS Upgrade 105.4	New this version - 8\n*****\nFeedback\n0 rising/o persistent - green if 0\nKnowledge per version	pending	\N	2026-07-14	\N	f	2026-07-07 11:52:26.50509+00	2026-07-13 19:04:05.679247+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "7ad8164a-6970-40ed-824f-bf27982d763e", "url": "https://code.devsnc.com/pages/aisearch/ais-upgrade-monitoring/dashboard_105.4.0.0.html", "description": "Upgarde monitor"}]
8779326b-ba87-46ea-b186-8a9fc1ee1f0f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS-IA Workflow review- Move		pending	\N	2026-07-07	\N	t	2026-07-06 18:20:01.097469+00	2026-07-07 19:45:07.006738+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "5c7d5f8d-b5bb-4395-82c0-143d4bc39791", "url": "https://code.devsnc.com/pages/aisearch/multi-agant-case-triage/ais-ia-workflow-reliability.html", "description": "Report"}]
2095a01f-4810-4eed-831b-7eb785c902fa	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Amazon return- pill cutter - Kohls		pending	2026-08-03	2026-07-18	\N	f	2026-07-06 11:58:47.058852+00	2026-07-12 23:07:38.267824+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
fedbfc25-ecfe-4b78-b937-f7021f0b8b19	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Medical Reimbursement-Ellison and Vivian		pending	\N	2026-08-01	\N	f	2026-05-26 21:30:47.455815+00	2026-07-12 22:44:09.402563+00	f	67b3275c-945c-4014-81d3-a2235118d527	[{"id": "0ac388ce-2a5b-4d2e-a83d-8848b1bce7e1", "url": "https://docs.google.com/spreadsheets/d/1bTKvwreq51kv1tlhy8yBC1MSCoukUoYEE00YnEQ8rJc/edit?usp=sharing", "description": "Tracker"}]
a5f61bb7-5d4d-47a6-aa27-fed1dacf8179	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Tasks Card on Views	Focussed vs All- why are the edit/check/cross on the bottom ?\n\nNeed an option to toggle High on -off from the card\nNeed an option to change the date	pending	\N	\N	\N	f	2026-07-04 21:50:24.710547+00	2026-07-12 21:37:03.541651+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
8169f596-1d5b-4511-bb17-5c9c1eb8288b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS Upgrade process	Next - put together data for past failures- Prashant	pending	2026-07-15	2026-07-14	\N	f	2026-07-09 11:51:26.315033+00	2026-07-13 16:34:03.806711+00	t	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "5bfd8c46-8abf-4b2a-b77c-daf04c85734e", "url": "https://teams.microsoft.com/l/message/19:408fdc4e60e6451196e0b54ea612ae25@thread.v2/1783610059851?context=%7B%22contextType%22%3A%22chat%22%7D", "description": "Summary post"}]
834d8b37-09b9-4dbd-a498-46f28d02e85f	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Meeting with Kurt- Mondays		pending	2026-07-20	2026-07-17	\N	f	2026-07-08 14:18:31.147896+00	2026-07-13 16:34:54.208099+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
bfa7e2ad-c42b-4e80-96af-dc0cf7dcd256	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Meeting with Paul W		done	\N	2026-07-13	2026-07-13 19:02:28.004582+00	f	2026-07-08 14:19:07.437226+00	2026-07-13 19:02:28.004587+00	t	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
2d02f0e6-8c45-4a40-af2c-fcbc2e48e097	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS OS: Review Hi Clone		done	\N	2026-07-08	2026-07-08 20:35:42.324294+00	f	2026-07-07 12:42:27.101811+00	2026-07-08 20:35:42.324299+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "bca11c25-a4b7-41ad-8c69-44e5650f3746", "url": "https://testinghvi41.service-now.com/xmlstats.do?include=ais", "description": "XML Stats"}, {"id": "6060b758-7e27-4390-a15e-51d8b2c83945", "url": "https://search-stage-ais-skuld004.ycg0.service-now.com/v20/stats", "description": "V20/stats"}]
447dbc52-2125-43bb-8e30-a1efbf10ffa1	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	SHP Meeting- Wednesdays	Discussion around Version for Glide\nAIS upgrade - who and how ?\nVulnerability scans\n\n*****\nJuly 8th\nUS Commercial to StackIt migration	done	2026-07-15	2026-07-13	2026-07-08 16:29:53.953321+00	f	2026-07-08 14:18:04.044214+00	2026-07-08 16:29:53.953327+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
69505c4e-d8c7-42ee-a0d4-bbef8676a17b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Review PHR Report		pending	\N	2026-07-14	\N	f	2026-07-08 17:03:50.917946+00	2026-07-13 20:04:52.558005+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "0e03c4f6-cba5-420f-a067-4ba551e81978", "url": "https://servicenow.sharepoint.com/:f:/r/sites/attiviosearch/Shared%20Documents/Operational%20Reports/SystemHealthReport/Partition%20Health%20Check/Jul-07-2026?csf=1&web=1&e=fWDWzU", "description": "PHR report July 7th"}]
13fea73e-c6ed-4f7a-b0d5-2f16d2f97777	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Demohub- Capacity calculations		pending	\N	2026-07-14	\N	f	2026-07-08 16:59:33.730866+00	2026-07-13 19:02:42.563548+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "cfb99cbc-6b28-4741-a4c2-c694afc59b4d", "url": "https://servicenow-my.sharepoint.com/:x:/r/personal/rajiv_narula_servicenow_com/Documents/Working%20with%20Prasanth/Demohub%20size%20calc.xlsx?d=w10989b2986c44133a517b4aff6a357c6&csf=1&web=1&e=KeHmfW", "description": "Spreadsheet - calculations"}]
54afc9ca-bf34-4aec-ba77-ac3e7fed9e66	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	FML/Dr Ly/kurt	Call Hartford -  855 532 7880\nClaim Number: 58340428/429\nConfirm - no more docs are needed. Decision ? Disrupt my salary ?\nNew claim\n1 888 301 5615\n\n****\nEmail Benefits on salary\n*****\n\npaid leave - 58340428 /58340429\nJune 10th through 18th\n\n\nReduced hours - 58697391\nJune 22nd : 4 h * 5\nJune 29th : 4h *4\nJuly 6th : 5h *4\nJuly 13th :	pending	\N	2026-07-14	\N	f	2026-06-02 21:59:02.072981+00	2026-07-13 20:11:14.729302+00	t	67b3275c-945c-4014-81d3-a2235118d527	[{"id": "2b51b447-6980-40a6-be1c-64c92f0c37ff", "url": "https://higsms.com/3GuRWSt", "description": "Hartford"}]
2fc66d09-4cf0-42d6-b1a7-f64498d0542e	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Travel plans	Franconia :\nGo-no-go: 2:00 PM on July 10\n\nNiagara :\nGo-no-go: 4:00pm, Aug 14, 2026	done	2026-07-10	2026-07-10	2026-07-12 21:30:29.10928+00	f	2026-07-07 22:15:47.991287+00	2026-07-12 21:30:29.10929+00	t	67b3275c-945c-4014-81d3-a2235118d527	[]
cd9fb1fe-ddb6-47e6-b7dd-242596d8f443	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS-Bot on Teams	Prashant to talk to Architect\nUpdate the arch diagram\n***	pending	\N	2026-07-14	\N	f	2026-07-08 13:09:49.274077+00	2026-07-13 19:03:41.587085+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "ab9b1847-7b2d-4e35-9014-0a86a7d49d96", "url": "https://surf.servicenow.com/now/apm/record/x_snc_earb_arb_requests/5bf33340cfb54f50ad4bfbd61d851c10", "description": "ARB"}]
1111d42f-aa83-4ed5-bbba-7d533cd977f8	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Managers Meeting - Wednesdays		pending	2026-07-15	2026-07-14	\N	f	2026-07-08 14:17:49.307778+00	2026-07-13 19:05:20.997057+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "3cc847e1-3321-49d0-b6d8-30e9b97d7371", "url": "https://servicenow.sharepoint.com/:fl:/r/contentstorage/CSP_0f0a74c2-31c2-431c-96a0-94dbd943e18f/Document%20Library/LoopAppData/07152026.loop?d=wfa25a36e726549cda156c72f84c041c3&csf=1&web=1&e=q2VTKq&nav=cz0lMkZjb250ZW50c3RvcmFnZSUyRkNTUF8wZjBhNzRjMi0zMWMyLTQzMWMtOTZhMC05NGRiZDk0M2UxOGYmZD1iJTIxd25RS0Q4SXhIRU9Xb0pUYjJVUGhqeF9KM2VvRVRnQkJ2TkVYdXA2Y1NpbUFDc2l4YW5hRVNhb3NhWEhmeUdZUyZmPTAxN0FNTFlMVE9VTVM3VVpMU1pWRTJDVldIRjZDTUFRT0QmYz0lMkYmYT1Mb29wQXBwJng9JTdCJTIydyUyMiUzQSUyMlQwUlRVSHh6WlhKMmFXTmxibTkzTG5Ob1lYSmxjRzlwYm5RdVkyOXRmR0loZDI1UlMwUTRTWGhJUlU5WGIwcFVZakpWVUdocWVGOUtNMlZ2UlZSblFrSjJUa1ZZZFhBMlkxTnBiVUZEYzJsNFlXNWhSVk5oYjNOaFdFaG1lVWRaVTN3d01UZEJUVXhaVEZaRFZVWldXa2czTTFoS1drSmFXRmRCTlZCTE4xcEVRVkpRJTIyJTJDJTIyaSUyMiUzQSUyMmQ4MDFiMjBiLWJmMjAtNDQzYy1iYWQ0LTFkZTdmOTEwYzkxZSUyMiU3RA%3D%3D", "description": "loop"}]
86278046-634a-4691-8aea-6aa1e97d0a58	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AIS-OS : Ingest and Search	OS Node is up and running. I know how to start ; stop and run a curl.\nNext step - do postman tests against the OS node directly	pending	\N	2026-07-14	\N	f	2026-07-02 00:20:16.685253+00	2026-07-13 20:04:37.966603+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "8352f1a9-0a16-42a2-864e-487f9baba2e3", "url": "https://code.devsnc.com/aisearch/opensearch-plugins/blob/master/opensearch.postman_collection.json", "description": "Postman"}]
6dd2387c-6407-4672-b1cb-c701da3e57e0	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	hello world- SnowSk8s		pending	\N	2026-07-14	\N	f	2026-07-12 23:43:52.413369+00	2026-07-13 20:04:46.846604+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
4c5a341d-c42d-4d01-b9e8-e3e39c00f344	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	PSP/SHP Weekly meetig	July 13th :\n-> Met Usha on load testing. Re-use data set and infra\n\nJul 8th :\n<-US commercial to Stackit migration.\n\nOpen questions\n<-Migration tooling\n<-Upgrade \n<-Vuln scan\n<-Version management	pending	2026-07-15	2026-07-14	\N	f	2026-07-08 16:35:19.127204+00	2026-07-13 20:04:54.568036+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[{"id": "59c199f3-5443-4b88-b519-d91928d284af", "url": "https://servicenow-my.sharepoint.com/:fl:/r/personal/raymond_lau_servicenow_com/Documents/Microsoft%20Teams%20Chat%20Files/Loop%20code%20block%204.loop?d=w0a504a541b344721b50f410ca2b08ca4&csf=1&web=1&e=roXfQQ&nav=cz0lMkZwZXJzb25hbCUyRnJheW1vbmRfbGF1X3NlcnZpY2Vub3dfY29tJmQ9YiUyMUIxYmI1VVpMYkVTMVJWM0VOY0lxNXF3NGJIRVNfRHhDbmd2UkFzNWdnNnY2Ulp0bHlVVHBUWkkwM2h3aEw4WGEmZj0wMUc3WFUyN1NVSkpJQVVOQTNFRkQzS0QyQkJTUkxCREZFJmM9JTJGJmE9TG9vcEFwcCZwPSU0MGZsdWlkeCUyRmxvb3AtcGFnZS1jb250YWluZXI%3D", "description": "Ray- Scan"}, {"id": "af6a0ce4-5b5e-4f16-9e06-c0dd10a80918", "url": "https://app.smartsheet.com/sheets/XRwm7VxFWpw24h876PfmRrfX83Qjv37V6Jq84V41", "description": "Project plan"}]
c35bdbd5-7efa-4424-8b9c-a3775dcf635d	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Reseacrh options	Department Developmental Services (DDS)\n Department of Mental Health (DMH)\n Department of Transitional Assistance (DTA)\n Elder Services (EOEA)\n Emergency Aid to the Elderly, Disabled, or Children (EAEDC)\n Federal Housing Choice Voucher Program (Section 8)\n Mass Hire / Division of Career Services\n Massachusetts Commission for the Blind (MCB)\n Massachusetts Commission for the Deaf and Hard of Hearing (MCDHH)\n MassAbility (MBY)\n Social Security Disability Insurance (SSDI)\n State funded public housing\n State Housing Voucher (Massachusetts Rental Voucher Program, Alternative Housing Voucher Program, etc.)\n Supplemental Security Income (SSI)\n Supplementary Nutrition Assistance Program (SNAP)\n Transitional Aid to Families with Dependent Children (TANF)\n Unemployment Benefits	pending	\N	\N	\N	f	2026-06-21 20:14:15.724134+00	2026-07-12 22:44:35.779058+00	f	67b3275c-945c-4014-81d3-a2235118d527	[]
65fa4a8f-2d59-41cd-936d-9be860a38f3b	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Complete Chat cleanup		done	\N	2026-07-12	2026-07-12 23:12:33.3476+00	f	2026-07-12 21:55:47.337592+00	2026-07-12 23:12:33.347608+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
a75da209-1832-46f2-8475-78b683f24317	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	OpenSource- Hello plugin		pending	\N	\N	\N	f	2026-07-12 23:44:29.915913+00	2026-07-12 23:44:57.18582+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
cf833d72-2ca4-410d-98da-6e312a796cc6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	AISOS - Ingest and Search		pending	\N	\N	\N	f	2026-07-12 23:44:15.319743+00	2026-07-12 23:45:20.391056+00	f	4116e9a4-0f37-4c96-a589-dca6e2c8977d	[]
380b9b1c-22fd-4e6f-b396-4d20bc883ced	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Book- OpenSource def guide		pending	\N	2026-07-14	\N	f	2026-07-12 23:42:33.143561+00	2026-07-13 20:11:00.269552+00	t	0f685964-a891-4bd9-b2ae-7574f7263cd4	[]
9bfeac3c-e07f-4d18-86fe-cdce25207fc6	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	Remove beliefs /LLM		pending	\N	\N	\N	f	2026-07-12 22:57:34.011751+00	2026-07-13 00:44:02.382293+00	f	8bdedbe8-9c73-4a58-8cf7-5577f284df9a	[]
\.


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_settings (id, user_id, created_at, updated_at, high_priority_daily_limit) FROM stdin;
4ea21d00-7aab-4c4e-a13d-05cc58922f59	1b75f432-7cbd-43f4-9e42-6a9c7983740a	2026-06-04 23:59:57.853195+00	2026-06-04 23:59:57.853198+00	\N
4a95dfaa-31be-47b1-8875-071e7ebb0512	314cb239-fb99-4424-8478-3f6fe1a5ccad	2026-06-05 00:42:03.486236+00	2026-06-05 00:42:03.486241+00	\N
91dec450-7a9f-4db6-886c-dcb74123ceed	47895d88-2913-41d3-b367-370107f955f4	2026-06-06 00:22:20.583507+00	2026-06-06 00:22:20.583509+00	\N
1467fa65-db09-42ce-b277-79dd36adbe0f	0776f012-3a28-4e1d-aa8e-d5babcecde35	2026-06-10 19:21:36.710672+00	2026-06-10 19:21:36.710675+00	\N
0e0aa850-0302-498c-87d2-2fc53a5f0d54	847c1ef9-b1f0-4b51-9e37-146dc02fd005	2026-06-19 20:00:11.779022+00	2026-06-19 20:00:11.779024+00	\N
10fc0e95-1589-4e26-bd7e-c4afb3cb954a	a9da1bf7-15aa-4c93-827d-4cf896e2939d	2026-07-01 13:40:02.076718+00	2026-07-01 13:40:02.076722+00	\N
02cca9e2-8729-4e2d-a139-118e2e8985db	e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	2026-07-03 21:10:38.994867+00	2026-07-03 21:10:38.994872+00	\N
c17aee36-63b6-4b6a-98d9-d523390036fa	2afec1e2-ebe6-4494-aeba-18a3268d22eb	2026-07-03 21:11:49.846147+00	2026-07-03 21:11:49.84615+00	\N
0216aaef-5922-407e-9a90-a5005b27c23b	2462518d-29f4-46a3-9cfe-116aece78b5e	2026-07-03 23:22:55.537055+00	2026-07-03 23:22:55.53712+00	\N
7c9cee51-b2fd-4cf5-993d-e83ba2541b17	cca1be35-b414-4cc6-ac62-cc01062e6c45	2026-07-03 23:23:44.690379+00	2026-07-03 23:23:44.690381+00	\N
4d12a47d-b831-4c97-af07-9fd7f22c54ae	6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	2026-07-04 00:13:20.423951+00	2026-07-04 00:13:20.423956+00	\N
907df23c-ffbc-4c60-8476-e5ee12dc9ec2	dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	2026-05-26 21:30:47.455815+00	2026-07-08 14:16:45.17876+00	50
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, auth_provider, auth_provider_id, created_at, updated_at, firebase_uid, email, display_name) FROM stdin;
00000000-0000-0000-0000-000000000000	\N	\N	2026-05-26 23:56:32.457208+00	2026-05-26 23:56:32.457208+00	\N	\N	\N
1b75f432-7cbd-43f4-9e42-6a9c7983740a	anonymous	\N	2026-06-04 23:59:57.797071+00	2026-06-04 23:59:57.797074+00	gepHm0l34yguvCNDrepOhMllONN2	\N	\N
dcb45f1b-5dfe-4028-b2e4-4405d3ff5719	\N	\N	2026-05-26 21:30:47.455815+00	2026-05-26 21:30:47.455815+00	OrjqfaDqZthrjDUkgOvd78qco8Z2	rajiv.narula@gmail.com	Rajiv Narula
314cb239-fb99-4424-8478-3f6fe1a5ccad	anonymous	\N	2026-06-05 00:42:03.36075+00	2026-06-05 00:42:03.360753+00	uDzksddg5PUVTAWfKTDgvxUOFPo1	\N	\N
47895d88-2913-41d3-b367-370107f955f4	anonymous	\N	2026-06-06 00:22:20.52135+00	2026-06-06 00:22:20.521353+00	EfhY1rjDOKO8QXFETgwKZMlc7KZ2	\N	\N
0776f012-3a28-4e1d-aa8e-d5babcecde35	anonymous	\N	2026-06-10 19:21:33.033224+00	2026-06-10 19:21:33.033228+00	Y64n3sCu1QXpCxBrIAqFKs7t8z12	\N	\N
847c1ef9-b1f0-4b51-9e37-146dc02fd005	anonymous	\N	2026-06-19 20:00:11.754842+00	2026-06-19 20:00:11.754845+00	4bfdhwGSL6SH72zdUaygWTAZd1t1	\N	\N
a9da1bf7-15aa-4c93-827d-4cf896e2939d	anonymous	\N	2026-07-01 13:40:02.039321+00	2026-07-01 13:40:02.039325+00	rvb7yiYtK8a3njMYnKdmoCKEkmU2	\N	\N
e3d4b6b8-5363-4c62-ad34-fbdaa0dfdab2	anonymous	\N	2026-07-03 21:10:38.923505+00	2026-07-03 21:10:38.923509+00	ipoM21ZrxLYxNts1Y9Kms6JoD6g1	\N	\N
2afec1e2-ebe6-4494-aeba-18a3268d22eb	google.com	\N	2026-07-03 21:11:49.827806+00	2026-07-03 21:11:49.827811+00	k4bGxUTN8aWp263RcvR5iAxQ7ZK2	milidas0@gmail.com	Mili Das
2462518d-29f4-46a3-9cfe-116aece78b5e	anonymous	\N	2026-07-03 23:22:55.329507+00	2026-07-03 23:22:55.32951+00	aSjhRxhvn7WbSlby2semmrFwYtn2	\N	\N
cca1be35-b414-4cc6-ac62-cc01062e6c45	google.com	\N	2026-07-03 23:23:44.662199+00	2026-07-03 23:23:44.662201+00	zLJuphwmpYOEVXCpQCVpyWrorgE2	randomplay457@gmail.com	Joe Kumar
6c00ef0f-ebe2-47b2-94cd-b9f6a2a71f48	anonymous	\N	2026-07-04 00:13:20.275794+00	2026-07-04 00:13:20.2758+00	24rm85gG4OYJuOvqe8CwzOPFmtO2	\N	\N
\.


--
-- Name: ai_cost_log ai_cost_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_cost_log
    ADD CONSTRAINT ai_cost_log_pkey PRIMARY KEY (id);


--
-- Name: beliefs beliefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beliefs
    ADD CONSTRAINT beliefs_pkey PRIMARY KEY (id);


--
-- Name: boards boards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boards
    ADD CONSTRAINT boards_pkey PRIMARY KEY (id);


--
-- Name: focused_view_configs focused_view_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.focused_view_configs
    ADD CONSTRAINT focused_view_configs_pkey PRIMARY KEY (id);


--
-- Name: focused_view_configs focused_view_configs_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.focused_view_configs
    ADD CONSTRAINT focused_view_configs_user_id_key UNIQUE (user_id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: task_labels task_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_pkey PRIMARY KEY (task_id, label_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);


--
-- Name: users users_firebase_uid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_firebase_uid_key UNIQUE (firebase_uid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: boards_user_id_default_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX boards_user_id_default_key ON public.boards USING btree (user_id) WHERE ((is_default = true) AND (is_deleted = false));


--
-- Name: ix_ai_cost_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_cost_log_user_id ON public.ai_cost_log USING btree (user_id);


--
-- Name: ix_beliefs_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_beliefs_task_id ON public.beliefs USING btree (task_id);


--
-- Name: ix_beliefs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_beliefs_user_id ON public.beliefs USING btree (user_id);


--
-- Name: ix_boards_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_boards_user_id ON public.boards USING btree (user_id);


--
-- Name: ix_focused_view_configs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_focused_view_configs_user_id ON public.focused_view_configs USING btree (user_id);


--
-- Name: ix_tasks_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_tasks_user_id ON public.tasks USING btree (user_id);


--
-- Name: labels_board_id_category_value_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX labels_board_id_category_value_key ON public.labels USING btree (board_id, category, value);


--
-- Name: ai_cost_log ai_cost_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_cost_log
    ADD CONSTRAINT ai_cost_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: beliefs beliefs_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beliefs
    ADD CONSTRAINT beliefs_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id);


--
-- Name: beliefs beliefs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beliefs
    ADD CONSTRAINT beliefs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: beliefs beliefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beliefs
    ADD CONSTRAINT beliefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: boards boards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boards
    ADD CONSTRAINT boards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: focused_view_configs focused_view_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.focused_view_configs
    ADD CONSTRAINT focused_view_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: labels labels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict puyHX17Y1Hen2WxEU0IGRUluwVFx8Jk8zn8eISkM0BwYwecOefFYaJMa7LbshsO

