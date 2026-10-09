--
-- PostgreSQL database dump
--

\restrict CQHh1awa1KguSrxhi1IHWecjA6p7IfqqITnUYAclu20h9Ad6uCME7Khj7OPuYXV

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: pulseplay
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO pulseplay;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pulseplay
--

COMMENT ON SCHEMA public IS '';


--
-- Name: BetStatus; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."BetStatus" AS ENUM (
    'OPEN',
    'WON',
    'LOST',
    'VOID',
    'SETTLED'
);


ALTER TYPE public."BetStatus" OWNER TO pulseplay;

--
-- Name: EventCategory; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."EventCategory" AS ENUM (
    'CRICKET',
    'FOOTBALL',
    'CRYPTO',
    'ELECTION'
);


ALTER TYPE public."EventCategory" OWNER TO pulseplay;

--
-- Name: EventStatus; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."EventStatus" AS ENUM (
    'SCHEDULED',
    'LIVE',
    'COMPLETED',
    'CANCELLED',
    'POSTPONED'
);


ALTER TYPE public."EventStatus" OWNER TO pulseplay;

--
-- Name: MarketStatus; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."MarketStatus" AS ENUM (
    'OPEN',
    'SUSPENDED',
    'CLOSED',
    'SETTLED'
);


ALTER TYPE public."MarketStatus" OWNER TO pulseplay;

--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."NotificationType" AS ENUM (
    'WALLET_APPROVED',
    'WALLET_REJECTED',
    'BET_PLACED',
    'BET_SETTLED',
    'MARKET_SUSPENDED',
    'MARKET_RESUMED',
    'ACCOUNT_ALERT'
);


ALTER TYPE public."NotificationType" OWNER TO pulseplay;

--
-- Name: WalletRequestStatus; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."WalletRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."WalletRequestStatus" OWNER TO pulseplay;

--
-- Name: WalletRequestType; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."WalletRequestType" AS ENUM (
    'INCREASE',
    'DECREASE'
);


ALTER TYPE public."WalletRequestType" OWNER TO pulseplay;

--
-- Name: WalletTransactionStatus; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."WalletTransactionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."WalletTransactionStatus" OWNER TO pulseplay;

--
-- Name: WalletTransactionType; Type: TYPE; Schema: public; Owner: pulseplay
--

CREATE TYPE public."WalletTransactionType" AS ENUM (
    'BET_LOCK',
    'BET_SETTLEMENT',
    'BET_REFUND',
    'ADMIN_CREDIT',
    'ADMIN_DEBIT',
    'ADJUSTMENT'
);


ALTER TYPE public."WalletTransactionType" OWNER TO pulseplay;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Bet; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Bet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    stake numeric(14,2) NOT NULL,
    "combinedOdds" numeric(8,4) NOT NULL,
    "potentialReturn" numeric(14,2) NOT NULL,
    status integer NOT NULL,
    "legCount" integer NOT NULL,
    "placedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "settledAt" timestamp(3) without time zone
);


ALTER TABLE public."Bet" OWNER TO pulseplay;

--
-- Name: BetSelectionLeg; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."BetSelectionLeg" (
    id integer NOT NULL,
    "betId" integer NOT NULL,
    "eventId" integer NOT NULL,
    "eventName" text NOT NULL,
    "marketId" integer NOT NULL,
    "marketName" text NOT NULL,
    "selectionId" integer NOT NULL,
    "selectionName" text NOT NULL,
    "oddsAtPlacement" numeric(8,4) NOT NULL
);


ALTER TABLE public."BetSelectionLeg" OWNER TO pulseplay;

--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."BetSelectionLeg_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."BetSelectionLeg_id_seq" OWNER TO pulseplay;

--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."BetSelectionLeg_id_seq" OWNED BY public."BetSelectionLeg".id;


--
-- Name: Bet_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."Bet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Bet_id_seq" OWNER TO pulseplay;

--
-- Name: Bet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."Bet_id_seq" OWNED BY public."Bet".id;


--
-- Name: Event; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Event" (
    id integer NOT NULL,
    "externalId" text,
    category integer NOT NULL,
    name text NOT NULL,
    competition text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    status integer NOT NULL,
    "scoreLabel" text,
    "minuteLabel" text,
    "homeTeamName" text,
    "homeTeamShort" text,
    "homeScore" text,
    "awayTeamName" text,
    "awayTeamShort" text,
    "awayScore" text,
    symbol text,
    "changePercent24h" numeric(8,4)
);


ALTER TABLE public."Event" OWNER TO pulseplay;

--
-- Name: Event_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."Event_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Event_id_seq" OWNER TO pulseplay;

--
-- Name: Event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."Event_id_seq" OWNED BY public."Event".id;


--
-- Name: Lookup; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Lookup" (
    id integer NOT NULL,
    "lookupTypeId" integer NOT NULL,
    code text NOT NULL,
    name text,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdOn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" integer,
    "modifiedOn" timestamp(3) without time zone,
    "modifiedBy" integer
);


ALTER TABLE public."Lookup" OWNER TO pulseplay;

--
-- Name: LookupType; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."LookupType" (
    id integer NOT NULL,
    code text NOT NULL,
    name text,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdOn" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" integer,
    "modifiedOn" timestamp(3) without time zone,
    "modifiedBy" integer
);


ALTER TABLE public."LookupType" OWNER TO pulseplay;

--
-- Name: Market; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Market" (
    id integer NOT NULL,
    "eventId" integer NOT NULL,
    "marketType" text NOT NULL,
    name text NOT NULL,
    status integer NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."Market" OWNER TO pulseplay;

--
-- Name: MarketSelection; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."MarketSelection" (
    id integer NOT NULL,
    "marketId" integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "currentPrice" numeric(8,4) NOT NULL,
    "priceVersion" integer DEFAULT 1 NOT NULL,
    status integer NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."MarketSelection" OWNER TO pulseplay;

--
-- Name: MarketSelection_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."MarketSelection_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."MarketSelection_id_seq" OWNER TO pulseplay;

--
-- Name: MarketSelection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."MarketSelection_id_seq" OWNED BY public."MarketSelection".id;


--
-- Name: Market_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."Market_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Market_id_seq" OWNER TO pulseplay;

--
-- Name: Market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."Market_id_seq" OWNED BY public."Market".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    type integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO pulseplay;

--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Notification_id_seq" OWNER TO pulseplay;

--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: PriceHistory; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."PriceHistory" (
    id integer NOT NULL,
    symbol text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    price numeric(14,2) NOT NULL
);


ALTER TABLE public."PriceHistory" OWNER TO pulseplay;

--
-- Name: PriceHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."PriceHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PriceHistory_id_seq" OWNER TO pulseplay;

--
-- Name: PriceHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."PriceHistory_id_seq" OWNED BY public."PriceHistory".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    "userCode" text NOT NULL,
    email text NOT NULL,
    mobile text NOT NULL,
    "avatarUrl" text,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "loggedOutAt" timestamp(3) without time zone,
    "ipAddress" text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "deletedOn" timestamp(3) without time zone,
    "deletedBy" integer
);


ALTER TABLE public."User" OWNER TO pulseplay;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO pulseplay;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Wallet; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."Wallet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    currency text NOT NULL,
    "availableBalance" numeric(14,2) NOT NULL,
    "lockedBalance" numeric(14,2) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Wallet" OWNER TO pulseplay;

--
-- Name: WalletLedger; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."WalletLedger" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    "transactionType" integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    "beforeAvailable" numeric(14,2) NOT NULL,
    "afterAvailable" numeric(14,2) NOT NULL,
    "beforeLocked" numeric(14,2) NOT NULL,
    "afterLocked" numeric(14,2) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    status integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text
);


ALTER TABLE public."WalletLedger" OWNER TO pulseplay;

--
-- Name: WalletLedger_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."WalletLedger_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."WalletLedger_id_seq" OWNER TO pulseplay;

--
-- Name: WalletLedger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."WalletLedger_id_seq" OWNED BY public."WalletLedger".id;


--
-- Name: WalletRequest; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."WalletRequest" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    type integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text NOT NULL,
    status integer NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedBy" text
);


ALTER TABLE public."WalletRequest" OWNER TO pulseplay;

--
-- Name: WalletRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."WalletRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."WalletRequest_id_seq" OWNER TO pulseplay;

--
-- Name: WalletRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."WalletRequest_id_seq" OWNED BY public."WalletRequest".id;


--
-- Name: WalletTransaction; Type: TABLE; Schema: public; Owner: pulseplay
--

CREATE TABLE public."WalletTransaction" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    type integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    status integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text
);


ALTER TABLE public."WalletTransaction" OWNER TO pulseplay;

--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."WalletTransaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."WalletTransaction_id_seq" OWNER TO pulseplay;

--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."WalletTransaction_id_seq" OWNED BY public."WalletTransaction".id;


--
-- Name: Wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: pulseplay
--

CREATE SEQUENCE public."Wallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Wallet_id_seq" OWNER TO pulseplay;

--
-- Name: Wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: pulseplay
--

ALTER SEQUENCE public."Wallet_id_seq" OWNED BY public."Wallet".id;


--
-- Name: Bet id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Bet" ALTER COLUMN id SET DEFAULT nextval('public."Bet_id_seq"'::regclass);


--
-- Name: BetSelectionLeg id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."BetSelectionLeg" ALTER COLUMN id SET DEFAULT nextval('public."BetSelectionLeg_id_seq"'::regclass);


--
-- Name: Event id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Event" ALTER COLUMN id SET DEFAULT nextval('public."Event_id_seq"'::regclass);


--
-- Name: Market id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Market" ALTER COLUMN id SET DEFAULT nextval('public."Market_id_seq"'::regclass);


--
-- Name: MarketSelection id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."MarketSelection" ALTER COLUMN id SET DEFAULT nextval('public."MarketSelection_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: PriceHistory id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."PriceHistory" ALTER COLUMN id SET DEFAULT nextval('public."PriceHistory_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Wallet id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Wallet" ALTER COLUMN id SET DEFAULT nextval('public."Wallet_id_seq"'::regclass);


--
-- Name: WalletLedger id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletLedger" ALTER COLUMN id SET DEFAULT nextval('public."WalletLedger_id_seq"'::regclass);


--
-- Name: WalletRequest id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletRequest" ALTER COLUMN id SET DEFAULT nextval('public."WalletRequest_id_seq"'::regclass);


--
-- Name: WalletTransaction id; Type: DEFAULT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletTransaction" ALTER COLUMN id SET DEFAULT nextval('public."WalletTransaction_id_seq"'::regclass);


--
-- Data for Name: Bet; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Bet" (id, "userId", stake, "combinedOdds", "potentialReturn", status, "legCount", "placedAt", "settledAt") FROM stdin;
\.


--
-- Data for Name: BetSelectionLeg; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."BetSelectionLeg" (id, "betId", "eventId", "eventName", "marketId", "marketName", "selectionId", "selectionName", "oddsAtPlacement") FROM stdin;
\.


--
-- Data for Name: Event; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Event" (id, "externalId", category, name, competition, "startTime", status, "scoreLabel", "minuteLabel", "homeTeamName", "homeTeamShort", "homeScore", "awayTeamName", "awayTeamShort", "awayScore", symbol, "changePercent24h") FROM stdin;
\.


--
-- Data for Name: Lookup; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Lookup" (id, "lookupTypeId", code, name, "isDeleted", "createdOn", "createdBy", "modifiedOn", "modifiedBy") FROM stdin;
\.


--
-- Data for Name: LookupType; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."LookupType" (id, code, name, "isDeleted", "createdOn", "createdBy", "modifiedOn", "modifiedBy") FROM stdin;
\.


--
-- Data for Name: Market; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Market" (id, "eventId", "marketType", name, status, version) FROM stdin;
\.


--
-- Data for Name: MarketSelection; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."MarketSelection" (id, "marketId", code, name, "currentPrice", "priceVersion", status, "sortOrder") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Notification" (id, "userId", type, title, message, read, "createdAt") FROM stdin;
\.


--
-- Data for Name: PriceHistory; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."PriceHistory" (id, symbol, "timestamp", price) FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."User" (id, name, "userCode", email, mobile, "avatarUrl", "passwordHash", "createdAt", "loggedOutAt", "ipAddress", "isDeleted", "deletedOn", "deletedBy") FROM stdin;
\.


--
-- Data for Name: Wallet; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."Wallet" (id, "userId", currency, "availableBalance", "lockedBalance", version, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: WalletLedger; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."WalletLedger" (id, "walletId", "userId", "transactionType", amount, "beforeAvailable", "afterAvailable", "beforeLocked", "afterLocked", "referenceType", "referenceId", status, "createdAt", "createdBy") FROM stdin;
\.


--
-- Data for Name: WalletRequest; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."WalletRequest" (id, "walletId", "userId", type, amount, reason, status, "requestedAt", "resolvedAt", "resolvedBy") FROM stdin;
\.


--
-- Data for Name: WalletTransaction; Type: TABLE DATA; Schema: public; Owner: pulseplay
--

COPY public."WalletTransaction" (id, "walletId", "userId", type, amount, "referenceType", "referenceId", status, "createdAt", "createdBy") FROM stdin;
\.


--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."BetSelectionLeg_id_seq"', 1, false);


--
-- Name: Bet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."Bet_id_seq"', 1, false);


--
-- Name: Event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."Event_id_seq"', 1, false);


--
-- Name: MarketSelection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."MarketSelection_id_seq"', 1, false);


--
-- Name: Market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."Market_id_seq"', 1, false);


--
-- Name: Notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."Notification_id_seq"', 1, false);


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."PriceHistory_id_seq"', 1, false);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."User_id_seq"', 1, false);


--
-- Name: WalletLedger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."WalletLedger_id_seq"', 1, false);


--
-- Name: WalletRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."WalletRequest_id_seq"', 1, false);


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."WalletTransaction_id_seq"', 1, false);


--
-- Name: Wallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: pulseplay
--

SELECT pg_catalog.setval('public."Wallet_id_seq"', 1, false);


--
-- Name: BetSelectionLeg BetSelectionLeg_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_pkey" PRIMARY KEY (id);


--
-- Name: Bet Bet_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_pkey" PRIMARY KEY (id);


--
-- Name: Event Event_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY (id);


--
-- Name: LookupType LookupType_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."LookupType"
    ADD CONSTRAINT "LookupType_pkey" PRIMARY KEY (id);


--
-- Name: Lookup Lookup_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Lookup"
    ADD CONSTRAINT "Lookup_pkey" PRIMARY KEY (id);


--
-- Name: MarketSelection MarketSelection_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_pkey" PRIMARY KEY (id);


--
-- Name: Market Market_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PriceHistory PriceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WalletLedger WalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: WalletRequest WalletRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransaction WalletTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Wallet Wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_pkey" PRIMARY KEY (id);


--
-- Name: BetSelectionLeg_betId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "BetSelectionLeg_betId_idx" ON public."BetSelectionLeg" USING btree ("betId");


--
-- Name: BetSelectionLeg_marketId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "BetSelectionLeg_marketId_idx" ON public."BetSelectionLeg" USING btree ("marketId");


--
-- Name: Bet_userId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "Bet_userId_idx" ON public."Bet" USING btree ("userId");


--
-- Name: Event_externalId_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "Event_externalId_key" ON public."Event" USING btree ("externalId");


--
-- Name: LookupType_code_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "LookupType_code_key" ON public."LookupType" USING btree (code);


--
-- Name: LookupType_isDeleted_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "LookupType_isDeleted_idx" ON public."LookupType" USING btree ("isDeleted");


--
-- Name: Lookup_isDeleted_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "Lookup_isDeleted_idx" ON public."Lookup" USING btree ("isDeleted");


--
-- Name: Lookup_type_code_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "Lookup_type_code_key" ON public."Lookup" USING btree ("lookupTypeId", code);


--
-- Name: MarketSelection_marketId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "MarketSelection_marketId_idx" ON public."MarketSelection" USING btree ("marketId");


--
-- Name: Market_eventId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "Market_eventId_idx" ON public."Market" USING btree ("eventId");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: PriceHistory_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "PriceHistory_symbol_timestamp_idx" ON public."PriceHistory" USING btree (symbol, "timestamp");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_mobile_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "User_mobile_key" ON public."User" USING btree (mobile);


--
-- Name: User_userCode_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "User_userCode_key" ON public."User" USING btree ("userCode");


--
-- Name: WalletLedger_walletId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "WalletLedger_walletId_idx" ON public."WalletLedger" USING btree ("walletId");


--
-- Name: WalletRequest_userId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "WalletRequest_userId_idx" ON public."WalletRequest" USING btree ("userId");


--
-- Name: WalletRequest_walletId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "WalletRequest_walletId_idx" ON public."WalletRequest" USING btree ("walletId");


--
-- Name: WalletTransaction_userId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "WalletTransaction_userId_idx" ON public."WalletTransaction" USING btree ("userId");


--
-- Name: WalletTransaction_walletId_idx; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE INDEX "WalletTransaction_walletId_idx" ON public."WalletTransaction" USING btree ("walletId");


--
-- Name: Wallet_userId_key; Type: INDEX; Schema: public; Owner: pulseplay
--

CREATE UNIQUE INDEX "Wallet_userId_key" ON public."Wallet" USING btree ("userId");


--
-- Name: BetSelectionLeg BetSelectionLeg_betId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_betId_fkey" FOREIGN KEY ("betId") REFERENCES public."Bet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BetSelectionLeg BetSelectionLeg_marketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES public."Market"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Bet Bet_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Bet Bet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_category_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_category_lookup_fkey" FOREIGN KEY (category) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lookup Lookup_lookupTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Lookup"
    ADD CONSTRAINT "Lookup_lookupTypeId_fkey" FOREIGN KEY ("lookupTypeId") REFERENCES public."LookupType"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MarketSelection MarketSelection_marketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES public."Market"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MarketSelection MarketSelection_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Market Market_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Market Market_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_type_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_type_lookup_fkey" FOREIGN KEY (type) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_deletedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletLedger WalletLedger_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletLedger WalletLedger_transactionType_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_transactionType_lookup_fkey" FOREIGN KEY ("transactionType") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletLedger WalletLedger_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_type_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_type_lookup_fkey" FOREIGN KEY (type) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_status_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_status_lookup_fkey" FOREIGN KEY (status) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_type_lookup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_type_lookup_fkey" FOREIGN KEY (type) REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Wallet Wallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: pulseplay
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pulseplay
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict CQHh1awa1KguSrxhi1IHWecjA6p7IfqqITnUYAclu20h9Ad6uCME7Khj7OPuYXV

