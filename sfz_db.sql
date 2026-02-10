--
-- PostgreSQL database dump
--

\restrict Ohva8AaVxERuFX3shRkCsXRXXgDI97WldTNxspENFo2f3dQpXCLnzaaeZOrD9Zd

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: barangays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barangays (
    id integer NOT NULL,
    name character varying
);


ALTER TABLE public.barangays OWNER TO postgres;

--
-- Name: barangays_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barangays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barangays_id_seq OWNER TO postgres;

--
-- Name: barangays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barangays_id_seq OWNED BY public.barangays.id;


--
-- Name: family_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.family_members (
    id integer NOT NULL,
    profile_id integer,
    last_name character varying,
    first_name character varying,
    middle_name character varying,
    ext_name character varying,
    relationship character varying,
    is_active boolean
);


ALTER TABLE public.family_members OWNER TO postgres;

--
-- Name: family_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.family_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.family_members_id_seq OWNER TO postgres;

--
-- Name: family_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.family_members_id_seq OWNED BY public.family_members.id;


--
-- Name: puroks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.puroks (
    id integer NOT NULL,
    name character varying
);


ALTER TABLE public.puroks OWNER TO postgres;

--
-- Name: puroks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.puroks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.puroks_id_seq OWNER TO postgres;

--
-- Name: puroks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.puroks_id_seq OWNED BY public.puroks.id;


--
-- Name: relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.relationships (
    id integer NOT NULL,
    name character varying
);


ALTER TABLE public.relationships OWNER TO postgres;

--
-- Name: relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.relationships_id_seq OWNER TO postgres;

--
-- Name: relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.relationships_id_seq OWNED BY public.relationships.id;


--
-- Name: resident_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resident_profiles (
    id integer NOT NULL,
    last_name character varying,
    first_name character varying,
    middle_name character varying,
    ext_name character varying,
    house_no character varying,
    purok character varying,
    barangay character varying,
    birthdate date,
    sex character varying,
    precinct_no character varying,
    civil_status character varying,
    occupation character varying,
    contact_no character varying,
    spouse_last_name character varying,
    spouse_first_name character varying,
    spouse_middle_name character varying,
    spouse_ext_name character varying,
    other_sector_details character varying,
    sector_summary character varying,
    is_active boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.resident_profiles OWNER TO postgres;

--
-- Name: resident_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resident_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resident_profiles_id_seq OWNER TO postgres;

--
-- Name: resident_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resident_profiles_id_seq OWNED BY public.resident_profiles.id;


--
-- Name: resident_sectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resident_sectors (
    resident_id integer,
    sector_id integer
);


ALTER TABLE public.resident_sectors OWNER TO postgres;

--
-- Name: sectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sectors (
    id integer NOT NULL,
    name character varying
);


ALTER TABLE public.sectors OWNER TO postgres;

--
-- Name: sectors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sectors_id_seq OWNER TO postgres;

--
-- Name: sectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sectors_id_seq OWNED BY public.sectors.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying,
    hashed_password character varying,
    role character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: barangays id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangays ALTER COLUMN id SET DEFAULT nextval('public.barangays_id_seq'::regclass);


--
-- Name: family_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members ALTER COLUMN id SET DEFAULT nextval('public.family_members_id_seq'::regclass);


--
-- Name: puroks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puroks ALTER COLUMN id SET DEFAULT nextval('public.puroks_id_seq'::regclass);


--
-- Name: relationships id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationships ALTER COLUMN id SET DEFAULT nextval('public.relationships_id_seq'::regclass);


--
-- Name: resident_profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resident_profiles ALTER COLUMN id SET DEFAULT nextval('public.resident_profiles_id_seq'::regclass);


--
-- Name: sectors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors ALTER COLUMN id SET DEFAULT nextval('public.sectors_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: barangays; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.barangays (id, name) FROM stdin;
1	Amagna
2	Apostol
3	Balincaguing
4	Farañal
5	Feria
6	Manglicmot
7	Rosete
8	San Rafael
9	Santo Niño
10	Sindol
11	Maloma
\.


--
-- Data for Name: family_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.family_members (id, profile_id, last_name, first_name, middle_name, ext_name, relationship, is_active) FROM stdin;
\.


--
-- Data for Name: puroks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.puroks (id, name) FROM stdin;
1	Purok 1
2	Purok 2
3	Purok 3
4	Purok 4
5	Purok 5
6	Purok 6
7	Purok 7
8	Purok 8
9	Purok 9
10	Purok 10
11	Purok 11
12	Purok 12
13	Purok 13
14	Purok 14
15	Purok 15
16	Purok 16
17	Purok 17
18	Purok 18
19	Purok 19
20	Purok 20
21	Sitio Yangil
22	Sitio Sagpat
23	Sitio Tektek
24	Sitio Cabuyao
25	Sitio Banawen
26	Sitio Anangka
27	Sitio Lubong
28	Sitio Cabaruan
29	Sitio Liwa
30	Sitio Kabwaan
\.


--
-- Data for Name: relationships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.relationships (id, name) FROM stdin;
1	Wife
2	Husband
3	Son
4	Daughter
5	Brother
6	Sister
7	Mother
8	Father
9	Grandmother
10	Grandfather
11	Grandson
12	Granddaughter
13	Live-in Partner
14	Guardian
\.


--
-- Data for Name: resident_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resident_profiles (id, last_name, first_name, middle_name, ext_name, house_no, purok, barangay, birthdate, sex, precinct_no, civil_status, occupation, contact_no, spouse_last_name, spouse_first_name, spouse_middle_name, spouse_ext_name, other_sector_details, sector_summary, is_active, created_at, updated_at) FROM stdin;
1	Nery	Louie	Guadalupe		#103 Fontecha ST.	Purok 19	Rosete	2020-08-04	Male	0012A	Single	Pogi	12345					\N	Student	t	2026-02-10 14:53:31.102838+08	\N
\.


--
-- Data for Name: resident_sectors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resident_sectors (resident_id, sector_id) FROM stdin;
1	12
\.


--
-- Data for Name: sectors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sectors (id, name) FROM stdin;
1	Indigenous People
2	Senior Citizen
3	PWD
4	BRGY. Official/Employee
5	OFW
6	Solo Parent
7	Farmers
8	Fisherfolk
9	Fisherman/Banca Owner
10	LGU Employee
11	TODA
12	Student
13	Lifeguard
14	Others
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, hashed_password, role) FROM stdin;
1	admin	$2b$12$D2cA3mxmss7LOmrFPv2cDOYENR5A/COEhl1VHec8XbF/u/F6.FaHG	admin
2	amagna	$2b$12$JbfG1YtSJiZ0pSleuRYwGOqqw6b2ZTRpU0yG1OPyt6CeeikzAEKt6	barangay
3	apostol	$2b$12$lokxiVSgt2cS0ON.wimcZ.i2vHzlAKqkeU1ToX5Ce40EVJ7k7Ywq6	barangay
4	balincaguing	$2b$12$tuuLo9kzmKHccDnUjCjPz.hGC/M7fxWt9/sd5NIPYBd8sTOguujzi	barangay
5	faranal	$2b$12$GY3eEFzNayuFPsdua5MYBeZQx1G8uwFanrbup8NhwtwYCUqY42N7e	barangay
6	feria	$2b$12$asbW.LWNE.tS6jvHsYLseuh/JlLa230jzN43HqCg/wgZKUypkz832	barangay
7	manglicmot	$2b$12$FTYWyN7HMoBgg8JWhOW2LeLcr/n2SKv8whjL5QXdF.IOlYfGIkwHG	barangay
8	rosete	$2b$12$tP1CMoDzi5X.AKU2/pqYmuQxcKwP5yQZSSQreFeu/x/OwfA9Vjl32	barangay
9	sanrafael	$2b$12$kCwNLMnFpNGnMXs3OHMnzu3.5nIDEz5frhx9ExYZv6RGKHyKZTSK2	barangay
10	santonino	$2b$12$x7P6lNm6LkEqJfZZUbT0nuJZn01DSGB/uYvP1GyIgoGlbDHhP2fRS	barangay
11	sindol	$2b$12$26vdTZ2u8kOEmzCeL05NtOQqnGxZk2E/hFBTrGVyWS8c74USBZI7a	barangay
12	maloma	$2b$12$ZorSODgIorR1nYtKhnhes.8bMT5GzzNOsMVFDsOy6CkZ2Ekjg7kJq	barangay
\.


--
-- Name: barangays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangays_id_seq', 11, true);


--
-- Name: family_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.family_members_id_seq', 1, false);


--
-- Name: puroks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.puroks_id_seq', 30, true);


--
-- Name: relationships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.relationships_id_seq', 14, true);


--
-- Name: resident_profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resident_profiles_id_seq', 1, true);


--
-- Name: sectors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sectors_id_seq', 14, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 12, true);


--
-- Name: barangays barangays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangays
    ADD CONSTRAINT barangays_pkey PRIMARY KEY (id);


--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_pkey PRIMARY KEY (id);


--
-- Name: puroks puroks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puroks
    ADD CONSTRAINT puroks_pkey PRIMARY KEY (id);


--
-- Name: relationships relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_pkey PRIMARY KEY (id);


--
-- Name: resident_profiles resident_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resident_profiles
    ADD CONSTRAINT resident_profiles_pkey PRIMARY KEY (id);


--
-- Name: sectors sectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sectors
    ADD CONSTRAINT sectors_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_barangays_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_barangays_id ON public.barangays USING btree (id);


--
-- Name: ix_barangays_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_barangays_name ON public.barangays USING btree (name);


--
-- Name: ix_family_members_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_family_members_id ON public.family_members USING btree (id);


--
-- Name: ix_puroks_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_puroks_id ON public.puroks USING btree (id);


--
-- Name: ix_puroks_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_puroks_name ON public.puroks USING btree (name);


--
-- Name: ix_relationships_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_relationships_id ON public.relationships USING btree (id);


--
-- Name: ix_relationships_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_relationships_name ON public.relationships USING btree (name);


--
-- Name: ix_resident_profiles_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_resident_profiles_barangay ON public.resident_profiles USING btree (barangay);


--
-- Name: ix_resident_profiles_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_resident_profiles_first_name ON public.resident_profiles USING btree (first_name);


--
-- Name: ix_resident_profiles_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_resident_profiles_id ON public.resident_profiles USING btree (id);


--
-- Name: ix_resident_profiles_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_resident_profiles_last_name ON public.resident_profiles USING btree (last_name);


--
-- Name: ix_resident_profiles_purok; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_resident_profiles_purok ON public.resident_profiles USING btree (purok);


--
-- Name: ix_sectors_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_sectors_id ON public.sectors USING btree (id);


--
-- Name: ix_sectors_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_sectors_name ON public.sectors USING btree (name);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: family_members family_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.resident_profiles(id);


--
-- Name: resident_sectors resident_sectors_resident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resident_sectors
    ADD CONSTRAINT resident_sectors_resident_id_fkey FOREIGN KEY (resident_id) REFERENCES public.resident_profiles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Ohva8AaVxERuFX3shRkCsXRXXgDI97WldTNxspENFo2f3dQpXCLnzaaeZOrD9Zd

