--
-- PostgreSQL database dump
--

\restrict l9ZwzUBLyrmEtRcBd8dsZeULrqcYuV2xSScRPwURxUTtYa0TPZp6TYsWzVn40k6

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: enforce_user_role_client(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_user_role_client() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  role_code TEXT;
BEGIN
  SELECT "code" INTO role_code FROM "Role" WHERE "id" = NEW."roleId";
  IF role_code = 'SUPER_ADMIN' AND NEW."clientId" IS NOT NULL THEN
    RAISE EXCEPTION 'SUPER_ADMIN must not belong to a client' USING ERRCODE = '23514';
  END IF;
  IF role_code <> 'SUPER_ADMIN' AND NEW."clientId" IS NULL THEN
    RAISE EXCEPTION 'Role % requires a client', role_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Bet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Bet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    stake numeric(14,2) NOT NULL,
    "combinedOdds" numeric(8,4) NOT NULL,
    "potentialReturn" numeric(14,2) NOT NULL,
    "statusId" integer NOT NULL,
    "legCount" integer NOT NULL,
    "placedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "settledAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" integer NOT NULL
);


--
-- Name: BetSelectionLeg; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."BetSelectionLeg_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."BetSelectionLeg_id_seq" OWNED BY public."BetSelectionLeg".id;


--
-- Name: Bet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Bet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Bet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Bet_id_seq" OWNED BY public."Bet".id;


--
-- Name: Client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Client" (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "isActive" integer DEFAULT 1 NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdByUserId" integer,
    "modifiedByUserId" integer
);


--
-- Name: Client_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Client_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Client_id_seq" OWNED BY public."Client".id;


--
-- Name: Event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Event" (
    id integer NOT NULL,
    "externalId" text,
    "categoryId" integer NOT NULL,
    name text NOT NULL,
    competition text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "statusId" integer NOT NULL,
    "scoreLabel" text,
    "minuteLabel" text,
    "homeTeamName" text,
    "homeTeamShort" text,
    "homeScore" text,
    "awayTeamName" text,
    "awayTeamShort" text,
    "awayScore" text,
    symbol text,
    "changePercent24h" numeric(8,4),
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Event_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Event_id_seq" OWNED BY public."Event".id;


--
-- Name: Lookup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lookup" (
    id integer NOT NULL,
    "lookupTypeId" integer NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LookupType; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LookupType" (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LookupType_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."LookupType_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: LookupType_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."LookupType_id_seq" OWNED BY public."LookupType".id;


--
-- Name: Lookup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Lookup_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Lookup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Lookup_id_seq" OWNED BY public."Lookup".id;


--
-- Name: Market; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Market" (
    id integer NOT NULL,
    "eventId" integer NOT NULL,
    "marketType" text NOT NULL,
    name text NOT NULL,
    "statusId" integer NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "modifiedByUserId" integer
);


--
-- Name: MarketSelection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MarketSelection" (
    id integer NOT NULL,
    "marketId" integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "currentPrice" numeric(8,4) NOT NULL,
    "priceVersion" integer DEFAULT 1 NOT NULL,
    "statusId" integer NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "modifiedByUserId" integer
);


--
-- Name: MarketSelection_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."MarketSelection_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MarketSelection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."MarketSelection_id_seq" OWNED BY public."MarketSelection".id;


--
-- Name: Market_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Market_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Market_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Market_id_seq" OWNED BY public."Market".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "typeId" integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: PriceHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PriceHistory" (
    id integer NOT NULL,
    symbol text NOT NULL,
    "timestamp" timestamp(3) without time zone NOT NULL,
    price numeric(14,2) NOT NULL
);


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PriceHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PriceHistory_id_seq" OWNED BY public."PriceHistory".id;


--
-- Name: Role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Role" (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Role_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Role_id_seq" OWNED BY public."Role".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    "userCode" text NOT NULL,
    email text NOT NULL,
    mobile text NOT NULL,
    "avatarUrl" text,
    "passwordHash" text NOT NULL,
    "lastLoginIp" text,
    "lastLoginAt" timestamp(3) without time zone,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "roleId" integer NOT NULL,
    "clientId" integer,
    "isActive" integer DEFAULT 1 NOT NULL,
    "mustChangePassword" integer DEFAULT 0 NOT NULL,
    "passwordChangedAt" timestamp(3) without time zone,
    "createdByUserId" integer,
    "modifiedByUserId" integer
);


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Wallet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    currency text NOT NULL,
    "availableBalance" numeric(14,2) NOT NULL,
    "lockedBalance" numeric(14,2) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "statusId" integer NOT NULL,
    "isDeleted" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WalletLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletLedger" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    "transactionTypeId" integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    "beforeAvailable" numeric(14,2) NOT NULL,
    "afterAvailable" numeric(14,2) NOT NULL,
    "beforeLocked" numeric(14,2) NOT NULL,
    "afterLocked" numeric(14,2) NOT NULL,
    "referenceTypeId" integer,
    "referenceId" text,
    "statusId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdByUserId" integer
);


--
-- Name: WalletLedger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletLedger_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletLedger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletLedger_id_seq" OWNED BY public."WalletLedger".id;


--
-- Name: WalletRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletRequest" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    "typeId" integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text NOT NULL,
    "statusId" integer NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "clientId" integer NOT NULL,
    "resolvedByUserId" integer
);


--
-- Name: WalletRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletRequest_id_seq" OWNED BY public."WalletRequest".id;


--
-- Name: WalletTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WalletTransaction" (
    id integer NOT NULL,
    "walletId" integer NOT NULL,
    "userId" integer NOT NULL,
    "typeId" integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    "referenceTypeId" integer,
    "referenceId" text,
    "statusId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdByUserId" integer
);


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."WalletTransaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."WalletTransaction_id_seq" OWNED BY public."WalletTransaction".id;


--
-- Name: Wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Wallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Wallet_id_seq" OWNED BY public."Wallet".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: vw_bets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bets AS
 SELECT b.id,
    b."userId",
    b.stake,
    b."combinedOdds",
    b."potentialReturn",
    b."statusId",
    b."legCount",
    b."placedAt",
    b."settledAt",
    b."updatedAt",
    b."clientId",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM (public."Bet" b
     JOIN public."Lookup" stat ON ((b."statusId" = stat.id)));


--
-- Name: vw_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_events AS
 SELECT e.id,
    e."externalId",
    e."categoryId",
    e.name,
    e.competition,
    e."startTime",
    e."statusId",
    e."scoreLabel",
    e."minuteLabel",
    e."homeTeamName",
    e."homeTeamShort",
    e."homeScore",
    e."awayTeamName",
    e."awayTeamShort",
    e."awayScore",
    e.symbol,
    e."changePercent24h",
    e."isDeleted",
    e."createdAt",
    e."updatedAt",
    cat.code AS "categoryCode",
    cat.label AS "categoryLabel",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM ((public."Event" e
     JOIN public."Lookup" cat ON ((e."categoryId" = cat.id)))
     JOIN public."Lookup" stat ON ((e."statusId" = stat.id)));


--
-- Name: vw_market_selections; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_market_selections AS
 SELECT ms.id,
    ms."marketId",
    ms.code,
    ms.name,
    ms."currentPrice",
    ms."priceVersion",
    ms."statusId",
    ms."sortOrder",
    ms."isDeleted",
    ms."createdAt",
    ms."updatedAt",
    ms."modifiedByUserId",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM (public."MarketSelection" ms
     JOIN public."Lookup" stat ON ((ms."statusId" = stat.id)));


--
-- Name: vw_markets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_markets AS
 SELECT m.id,
    m."eventId",
    m."marketType",
    m.name,
    m."statusId",
    m.version,
    m."isDeleted",
    m."createdAt",
    m."updatedAt",
    m."modifiedByUserId",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM (public."Market" m
     JOIN public."Lookup" stat ON ((m."statusId" = stat.id)));


--
-- Name: vw_notifications; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_notifications AS
 SELECT n.id,
    n."userId",
    n."typeId",
    n.title,
    n.message,
    n.read,
    n."createdAt",
    typ.code AS "typeCode",
    typ.label AS "typeLabel"
   FROM (public."Notification" n
     JOIN public."Lookup" typ ON ((n."typeId" = typ.id)));


--
-- Name: vw_wallet_ledger; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_wallet_ledger AS
 SELECT wl.id,
    wl."walletId",
    wl."userId",
    wl."transactionTypeId",
    wl.amount,
    wl."beforeAvailable",
    wl."afterAvailable",
    wl."beforeLocked",
    wl."afterLocked",
    wl."referenceTypeId",
    wl."referenceId",
    wl."statusId",
    wl."createdAt",
    wl."createdByUserId",
    typ.code AS "transactionTypeCode",
    typ.label AS "transactionTypeLabel",
    stat.code AS "statusCode",
    stat.label AS "statusLabel",
    ref.code AS "referenceTypeCode",
    ref.label AS "referenceTypeLabel"
   FROM (((public."WalletLedger" wl
     JOIN public."Lookup" typ ON ((wl."transactionTypeId" = typ.id)))
     JOIN public."Lookup" stat ON ((wl."statusId" = stat.id)))
     LEFT JOIN public."Lookup" ref ON ((wl."referenceTypeId" = ref.id)));


--
-- Name: vw_wallet_requests; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_wallet_requests AS
 SELECT wr.id,
    wr."walletId",
    wr."userId",
    wr."typeId",
    wr.amount,
    wr.reason,
    wr."statusId",
    wr."requestedAt",
    wr."resolvedAt",
    wr."clientId",
    wr."resolvedByUserId",
    typ.code AS "typeCode",
    typ.label AS "typeLabel",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM ((public."WalletRequest" wr
     JOIN public."Lookup" typ ON ((wr."typeId" = typ.id)))
     JOIN public."Lookup" stat ON ((wr."statusId" = stat.id)));


--
-- Name: vw_wallet_transactions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_wallet_transactions AS
 SELECT wt.id,
    wt."walletId",
    wt."userId",
    wt."typeId",
    wt.amount,
    wt."referenceTypeId",
    wt."referenceId",
    wt."statusId",
    wt."createdAt",
    wt."createdByUserId",
    typ.code AS "typeCode",
    typ.label AS "typeLabel",
    stat.code AS "statusCode",
    stat.label AS "statusLabel",
    ref.code AS "referenceTypeCode",
    ref.label AS "referenceTypeLabel"
   FROM (((public."WalletTransaction" wt
     JOIN public."Lookup" typ ON ((wt."typeId" = typ.id)))
     JOIN public."Lookup" stat ON ((wt."statusId" = stat.id)))
     LEFT JOIN public."Lookup" ref ON ((wt."referenceTypeId" = ref.id)));


--
-- Name: vw_wallets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_wallets AS
 SELECT w.id,
    w."userId",
    w.currency,
    w."availableBalance",
    w."lockedBalance",
    w.version,
    w."statusId",
    w."isDeleted",
    w."createdAt",
    w."updatedAt",
    stat.code AS "statusCode",
    stat.label AS "statusLabel"
   FROM (public."Wallet" w
     JOIN public."Lookup" stat ON ((w."statusId" = stat.id)));


--
-- Name: Bet id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bet" ALTER COLUMN id SET DEFAULT nextval('public."Bet_id_seq"'::regclass);


--
-- Name: BetSelectionLeg id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetSelectionLeg" ALTER COLUMN id SET DEFAULT nextval('public."BetSelectionLeg_id_seq"'::regclass);


--
-- Name: Client id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client" ALTER COLUMN id SET DEFAULT nextval('public."Client_id_seq"'::regclass);


--
-- Name: Event id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event" ALTER COLUMN id SET DEFAULT nextval('public."Event_id_seq"'::regclass);


--
-- Name: Lookup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lookup" ALTER COLUMN id SET DEFAULT nextval('public."Lookup_id_seq"'::regclass);


--
-- Name: LookupType id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LookupType" ALTER COLUMN id SET DEFAULT nextval('public."LookupType_id_seq"'::regclass);


--
-- Name: Market id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Market" ALTER COLUMN id SET DEFAULT nextval('public."Market_id_seq"'::regclass);


--
-- Name: MarketSelection id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketSelection" ALTER COLUMN id SET DEFAULT nextval('public."MarketSelection_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: PriceHistory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory" ALTER COLUMN id SET DEFAULT nextval('public."PriceHistory_id_seq"'::regclass);


--
-- Name: Role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role" ALTER COLUMN id SET DEFAULT nextval('public."Role_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Wallet id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet" ALTER COLUMN id SET DEFAULT nextval('public."Wallet_id_seq"'::regclass);


--
-- Name: WalletLedger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger" ALTER COLUMN id SET DEFAULT nextval('public."WalletLedger_id_seq"'::regclass);


--
-- Name: WalletRequest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest" ALTER COLUMN id SET DEFAULT nextval('public."WalletRequest_id_seq"'::regclass);


--
-- Name: WalletTransaction id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction" ALTER COLUMN id SET DEFAULT nextval('public."WalletTransaction_id_seq"'::regclass);


--
-- Data for Name: Bet; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Bet" (id, "userId", stake, "combinedOdds", "potentialReturn", "statusId", "legCount", "placedAt", "settledAt", "updatedAt", "clientId") FROM stdin;
14	11	500.00	1.8000	900.00	15	1	2026-08-15 07:50:00	2026-08-15 08:15:00	2026-09-27 20:54:11.956	1
15	11	500.00	3.1400	1570.00	14	2	2026-08-15 08:30:00	\N	2026-09-27 20:54:11.96	1
16	11	300.00	1.9000	570.00	16	1	2026-07-09 08:40:00	2026-07-09 09:10:00	2026-09-27 20:54:11.963	1
17	11	200.00	2.1000	420.00	17	1	2026-06-01 10:00:00	2026-06-02 09:00:00	2026-09-27 20:54:11.966	1
\.


--
-- Data for Name: BetSelectionLeg; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BetSelectionLeg" (id, "betId", "eventId", "eventName", "marketId", "marketName", "selectionId", "selectionName", "oddsAtPlacement") FROM stdin;
17	14	31	India vs Australia	37	Match Winner	79	India	1.8000
18	15	32	Man City vs Real Madrid	39	Match Winner	83	Man City	1.6500
19	15	32	Man City vs Real Madrid	40	Total Goals	86	Over 2.5	1.9000
20	16	31	India vs Australia	38	2 Over Total Runs >= 30	82	No	1.9000
21	17	35	Arsenal vs Tottenham	39	Match Winner	83	Arsenal	2.1000
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Client" (id, code, name, "isActive", "isDeleted", "createdAt", "updatedAt", "createdByUserId", "modifiedByUserId") FROM stdin;
1	DEMO	Demo Client	1	0	2026-09-26 23:24:21.881	2026-09-26 23:24:21.881	\N	\N
\.


--
-- Data for Name: Event; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Event" (id, "externalId", "categoryId", name, competition, "startTime", "statusId", "scoreLabel", "minuteLabel", "homeTeamName", "homeTeamShort", "homeScore", "awayTeamName", "awayTeamShort", "awayScore", symbol, "changePercent24h", "isDeleted", "createdAt", "updatedAt") FROM stdin;
40	2494052	2	Arsenal vs Leeds United	English Premier League	2026-10-10 11:30:00	5	\N	\N	Arsenal	A	\N	Leeds United	LU	\N	\N	\N	0	2026-09-28 05:18:51.727	2026-09-28 05:18:51.727
33	\N	2	Liverpool vs Chelsea	Premier League	2026-08-15 17:00:00	6	2-1	68'	Liverpool	LIV	25	Chelsea	CHE	25	\N	\N	0	2026-09-27 20:54:11.904	2026-09-28 05:34:27.725
34	\N	2	Barcelona vs Sevilla	La Liga	2026-08-15 19:00:00	6	3-1	74'	Barcelona	BAR	34	Sevilla	SEV	31	\N	\N	0	2026-09-27 20:54:11.905	2026-09-28 05:34:27.726
32	\N	2	Man City vs Real Madrid	UEFA Champions League	2026-08-15 18:00:00	6	1-0	56'	Man City	MCI	27	Real Madrid	RMA	26	\N	\N	0	2026-09-27 20:54:11.901	2026-09-28 05:34:47.899
37	\N	3	Bitcoin (BTC)	Crypto Markets	2026-08-15 00:00:00	6	\N	\N	\N	\N	\N	\N	\N	\N	BTC	-1.6762	0	2026-09-27 20:54:11.911	2026-09-28 05:34:48.635
38	\N	3	Ethereum (ETH)	Crypto Markets	2026-08-15 00:00:00	6	\N	\N	\N	\N	\N	\N	\N	\N	ETH	-1.9973	0	2026-09-27 20:54:11.913	2026-09-28 05:34:48.643
31	\N	1	India vs Australia	T20 World Cup	2026-08-15 14:00:00	6	124/3	Over 12.4	India	IND	474	Australia	AUS	\N	\N	\N	0	2026-09-27 20:54:11.891	2026-09-28 05:34:52.965
35	\N	2	Arsenal vs Tottenham	Premier League	2026-08-16 20:00:00	5	\N	\N	Arsenal	ARS	\N	Tottenham	TOT	\N	\N	\N	0	2026-09-27 20:54:11.907	2026-09-27 20:54:11.907
36	\N	2	PSG vs Marseille	Ligue 1	2026-08-17 19:30:00	5	\N	\N	PSG	PSG	\N	Marseille	MAR	\N	\N	\N	0	2026-09-27 20:54:11.909	2026-09-27 20:54:11.909
39	\N	4	National Election 2026	National Election	2026-11-05 00:00:00	5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2026-09-27 20:54:11.915	2026-09-27 20:54:11.915
\.


--
-- Data for Name: Lookup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Lookup" (id, "lookupTypeId", code, label, "sortOrder", "isDeleted", "createdAt", "updatedAt") FROM stdin;
1	1	CRICKET	Cricket	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
2	1	FOOTBALL	Football	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
3	1	CRYPTO	Crypto	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
4	1	ELECTION	Election	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
5	2	SCHEDULED	Scheduled	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
6	2	LIVE	Live	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
7	2	COMPLETED	Completed	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
8	2	CANCELLED	Cancelled	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
9	2	POSTPONED	Postponed	4	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
10	3	OPEN	Open	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
11	3	SUSPENDED	Suspended	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
12	3	CLOSED	Closed	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
13	3	SETTLED	Settled	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
14	4	OPEN	Open	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
15	4	WON	Won	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
16	4	LOST	Lost	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
17	4	VOID	Void	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
18	4	SETTLED	Settled	4	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
19	5	ACTIVE	Active	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
20	6	BET_LOCK	Bet Lock	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
21	6	BET_SETTLEMENT	Bet Settlement	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
22	6	BET_REFUND	Bet Refund	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
23	6	ADMIN_CREDIT	Admin Credit	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
24	6	ADMIN_DEBIT	Admin Debit	4	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
25	6	ADJUSTMENT	Adjustment	5	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
26	7	PENDING	Pending	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
27	7	COMPLETED	Completed	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
28	7	APPROVED	Approved	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
29	7	REJECTED	Rejected	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
30	8	BET	Bet	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
31	8	WALLET_REQUEST	Wallet Request	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
32	9	INCREASE	Increase	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
33	9	DECREASE	Decrease	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
34	10	PENDING	Pending	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
35	10	APPROVED	Approved	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
36	10	REJECTED	Rejected	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
37	11	WALLET_APPROVED	Wallet Approved	0	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
38	11	WALLET_REJECTED	Wallet Rejected	1	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
39	11	BET_PLACED	Bet Placed	2	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
40	11	BET_SETTLED	Bet Settled	3	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
41	11	MARKET_SUSPENDED	Market Suspended	4	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
42	11	MARKET_RESUMED	Market Resumed	5	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
43	11	ACCOUNT_ALERT	Account Alert	6	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
44	11	WALLET_REQUEST_RECEIVED	Wallet Request Received	7	0	2026-09-28 02:01:29.66	2026-09-28 02:01:29.66
\.


--
-- Data for Name: LookupType; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LookupType" (id, code, name, "isDeleted", "createdAt", "updatedAt") FROM stdin;
1	EVENT_CATEGORY	Event Category	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
2	EVENT_STATUS	Event Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
3	MARKET_STATUS	Market Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
4	BET_STATUS	Bet Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
5	WALLET_STATUS	Wallet Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
6	WALLET_TRANSACTION_TYPE	Wallet Transaction Type	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
7	WALLET_TRANSACTION_STATUS	Wallet Transaction Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
8	REFERENCE_TYPE	Reference Type	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
9	WALLET_REQUEST_TYPE	Wallet Request Type	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
10	WALLET_REQUEST_STATUS	Wallet Request Status	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
11	NOTIFICATION_TYPE	Notification Type	0	2026-09-26 17:23:06.867	2026-09-26 17:23:06.867
\.


--
-- Data for Name: Market; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Market" (id, "eventId", "marketType", name, "statusId", version, "isDeleted", "createdAt", "updatedAt", "modifiedByUserId") FROM stdin;
37	31	MATCH_WINNER	Match Winner	10	1	0	2026-09-27 20:54:11.917	2026-09-27 20:54:11.917	\N
38	31	OVER_TOTAL_RUNS	2 Over Total Runs >= 30	10	1	0	2026-09-27 20:54:11.922	2026-09-27 20:54:11.922	\N
39	32	MATCH_WINNER	Match Winner	10	1	0	2026-09-27 20:54:11.926	2026-09-27 20:54:11.926	\N
40	32	TOTAL_GOALS	Total Goals	10	1	0	2026-09-27 20:54:11.93	2026-09-27 20:54:11.93	\N
41	32	NEXT_GOAL	Next Goal (2nd Half)	10	1	0	2026-09-27 20:54:11.934	2026-09-27 20:54:11.934	\N
42	32	BOTH_TEAMS_TO_SCORE	Both Teams to Score	10	1	0	2026-09-27 20:54:11.937	2026-09-27 20:54:11.937	\N
43	37	PRICE_AT_TIMESTAMP	Will BTC be above $60,000 tomorrow 12:00 PM?	10	1	0	2026-09-27 20:54:11.94	2026-09-27 20:54:11.94	\N
44	37	PRICE_RANGE	$65,000 - $68,000 tomorrow	11	1	0	2026-09-27 20:54:11.943	2026-09-27 20:54:11.943	\N
45	39	OFFICIAL_WINNER	Winner of Election	10	1	0	2026-09-27 20:54:11.947	2026-09-27 20:54:11.947	\N
46	39	PARTY_WINNER	Which Party Will Win	10	1	0	2026-09-27 20:54:11.95	2026-09-27 20:54:11.95	\N
47	39	VOTER_TURNOUT	Will Voter Turnout Exceed 60%?	10	1	0	2026-09-27 20:54:11.953	2026-09-27 20:54:11.953	\N
48	40	MATCH_WINNER	Match Winner	10	1	0	2026-09-28 05:18:51.755	2026-09-28 05:18:51.755	\N
\.


--
-- Data for Name: MarketSelection; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MarketSelection" (id, "marketId", code, name, "currentPrice", "priceVersion", "statusId", "sortOrder", "isDeleted", "createdAt", "updatedAt", "modifiedByUserId") FROM stdin;
94	43	NO	No	2.0700	37	10	1	0	2026-09-27 20:54:11.94	2026-09-28 05:34:48.636	\N
93	43	YES	Yes	1.8600	37	10	0	0	2026-09-27 20:54:11.94	2026-09-28 05:34:48.638	\N
83	39	HOME	Man City	1.5500	190	10	0	0	2026-09-27 20:54:11.926	2026-09-28 05:34:52.932	\N
84	39	DRAW	Draw	3.6400	190	10	1	0	2026-09-27 20:54:11.926	2026-09-28 05:34:52.953	\N
85	39	AWAY	Real Madrid	5.7100	190	10	2	0	2026-09-27 20:54:11.926	2026-09-28 05:34:52.954	\N
87	40	UNDER_2_5	Under 2.5	2.0100	188	10	1	0	2026-09-27 20:54:11.93	2026-09-28 05:34:52.955	\N
86	40	OVER_2_5	Over 2.5	1.7800	188	10	0	0	2026-09-27 20:54:11.93	2026-09-28 05:34:52.957	\N
88	41	HOME	Man City	1.6400	187	10	0	0	2026-09-27 20:54:11.934	2026-09-28 05:34:52.958	\N
89	41	NONE	No Goal	5.1300	187	10	1	0	2026-09-27 20:54:11.934	2026-09-28 05:34:52.96	\N
90	41	AWAY	Real Madrid	1.5100	187	10	2	0	2026-09-27 20:54:11.934	2026-09-28 05:34:52.961	\N
91	42	YES	Yes	2.0200	187	10	0	0	2026-09-27 20:54:11.937	2026-09-28 05:34:52.963	\N
92	42	NO	No	2.1400	187	10	1	0	2026-09-27 20:54:11.937	2026-09-28 05:34:52.964	\N
80	37	AUS	Australia	2.5600	189	10	1	0	2026-09-27 20:54:11.917	2026-09-28 05:34:52.967	\N
79	37	IND	India	1.6000	189	10	0	0	2026-09-27 20:54:11.917	2026-09-28 05:34:52.968	\N
95	44	IN_RANGE	In range	1.6000	2	10	0	0	2026-09-27 20:54:11.943	2026-09-27 20:54:11.943	\N
96	45	CAND_A	Candidate A	1.7000	1	10	0	0	2026-09-27 20:54:11.947	2026-09-27 20:54:11.947	\N
97	45	CAND_B	Candidate B	2.2000	1	10	1	0	2026-09-27 20:54:11.947	2026-09-27 20:54:11.947	\N
98	46	PARTY_A	Unity Party	1.7500	1	10	0	0	2026-09-27 20:54:11.95	2026-09-27 20:54:11.95	\N
82	38	NO	No	2.2300	188	10	1	0	2026-09-27 20:54:11.922	2026-09-28 05:34:52.969	\N
81	38	YES	Yes	1.6100	188	10	0	0	2026-09-27 20:54:11.922	2026-09-28 05:34:52.97	\N
99	46	PARTY_B	Progress Party	2.0500	1	10	1	0	2026-09-27 20:54:11.95	2026-09-27 20:54:11.95	\N
100	47	YES	Yes	1.9000	1	10	0	0	2026-09-27 20:54:11.953	2026-09-27 20:54:11.953	\N
101	47	NO	No	1.9000	1	10	1	0	2026-09-27 20:54:11.953	2026-09-27 20:54:11.953	\N
102	48	HOME	Arsenal	2.0300	1	10	0	0	2026-09-28 05:18:51.755	2026-09-28 05:18:51.755	\N
103	48	DRAW	Draw	3.5200	1	10	1	0	2026-09-28 05:18:51.755	2026-09-28 05:18:51.755	\N
104	48	AWAY	Leeds United	2.8300	1	10	2	0	2026-09-28 05:18:51.755	2026-09-28 05:18:51.755	\N
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", "typeId", title, message, read, "createdAt") FROM stdin;
20	11	40	You Won!	You've won ₹1,250.00 on India vs Australia	f	2026-08-15 08:15:00
21	11	37	Deposit Approved	Your deposit of ₹5,000.00 was approved	f	2026-08-15 20:45:00
22	11	39	Bet Placed	Your bet on Man City has been placed successfully	t	2026-08-15 08:30:00
23	11	37	Permission Request Approved	Your request of ₹1,000.00 was approved	t	2026-08-01 10:30:00
24	11	43	System Alert	Scheduled maintenance on 20 Aug, 02:00 - 03:00 AM	t	2026-08-14 09:00:00
\.


--
-- Data for Name: PriceHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PriceHistory" (id, symbol, "timestamp", price) FROM stdin;
151	BTC	2026-09-28 05:18:51.819	83244.00
152	ETH	2026-09-28 05:18:51.819	2649.33
153	BTC	2026-09-28 05:19:22.211	83220.00
154	ETH	2026-09-28 05:19:22.211	2649.00
155	BTC	2026-09-28 05:20:22.831	83218.00
156	ETH	2026-09-28 05:20:22.831	2649.56
157	BTC	2026-09-28 05:21:23.448	83227.00
158	ETH	2026-09-28 05:21:23.448	2649.71
159	BTC	2026-09-28 05:22:23.967	83239.00
160	ETH	2026-09-28 05:22:23.967	2650.24
161	BTC	2026-09-28 05:23:24.494	83217.00
162	ETH	2026-09-28 05:23:24.494	2649.58
163	BTC	2026-09-28 05:24:25.021	83215.00
164	ETH	2026-09-28 05:24:25.021	2649.09
165	BTC	2026-09-28 05:25:25.515	83076.00
166	ETH	2026-09-28 05:25:25.515	2646.70
167	BTC	2026-09-28 05:26:25.737	83070.00
168	ETH	2026-09-28 05:26:25.737	2646.10
169	BTC	2026-09-28 05:27:26.226	83057.00
170	ETH	2026-09-28 05:27:26.226	2646.15
171	BTC	2026-09-28 05:28:26.695	83055.00
172	ETH	2026-09-28 05:28:26.695	2646.41
173	BTC	2026-09-28 05:29:27.242	83085.00
174	ETH	2026-09-28 05:29:27.242	2647.65
175	BTC	2026-09-28 05:30:46.401	83094.00
176	ETH	2026-09-28 05:30:46.401	2648.30
177	BTC	2026-09-28 05:31:46.962	83052.00
178	ETH	2026-09-28 05:31:46.962	2647.88
179	BTC	2026-09-28 05:32:47.481	83054.00
180	ETH	2026-09-28 05:32:47.481	2646.32
181	BTC	2026-09-28 05:33:48.085	83063.00
182	ETH	2026-09-28 05:33:48.085	2644.95
183	BTC	2026-09-28 05:34:48.625	83013.00
184	ETH	2026-09-28 05:34:48.625	2644.45
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Role" (id, code, name, "isDeleted", "createdAt", "updatedAt") FROM stdin;
1	SUPER_ADMIN	Super Admin	0	2026-09-26 23:24:21.881	2026-09-26 23:24:21.881
2	CLIENT_ADMIN	Client Admin	0	2026-09-26 23:24:21.881	2026-09-26 23:24:21.881
3	CLIENT_USER	Client User	0	2026-09-26 23:24:21.881	2026-09-26 23:24:21.881
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, "userCode", email, mobile, "avatarUrl", "passwordHash", "lastLoginIp", "lastLoginAt", "isDeleted", "createdAt", "updatedAt", "roleId", "clientId", "isActive", "mustChangePassword", "passwordChangedAt", "createdByUserId", "modifiedByUserId") FROM stdin;
9	System Admin	ID#ADMIN	admin@pulseplay.local	0000000000	\N	$2a$10$an19Z2aRxsIaDqVhGoZ2Aeotgpa.Qy9k76SKAK9JHRNLRZV6XiqcG	::1	2026-09-28 05:20:09.783	0	2026-09-27 20:54:11.879	2026-09-28 05:20:09.786	1	\N	1	0	\N	\N	\N
11	Rohan Kumar	ID#10245	rohan.kumar@example.com	9876543210	\N	$2a$10$9DHTG/Ve0WLwzKLHNUgnduTVDJyoDk/m5yZmqmoIUnkePIKwgQEJ2	\N	\N	0	2026-09-27 20:54:11.886	2026-09-28 05:21:49.352	3	1	1	1	2026-09-28 05:21:49.345	\N	9
10	Demo Client Admin	ID#CADMIN	client.admin@example.com	0000000001	\N	$2a$10$an19Z2aRxsIaDqVhGoZ2Aeotgpa.Qy9k76SKAK9JHRNLRZV6XiqcG	::1	2026-09-28 05:22:52.66	0	2026-09-27 20:54:11.883	2026-09-28 05:22:52.665	2	1	1	0	\N	\N	\N
\.


--
-- Data for Name: Wallet; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Wallet" (id, "userId", currency, "availableBalance", "lockedBalance", version, "statusId", "isDeleted", "createdAt", "updatedAt") FROM stdin;
5	11	INR	18560.50	6000.00	1	19	0	2026-09-27 20:54:11.888	2026-09-27 20:54:11.888
\.


--
-- Data for Name: WalletLedger; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WalletLedger" (id, "walletId", "userId", "transactionTypeId", amount, "beforeAvailable", "afterAvailable", "beforeLocked", "afterLocked", "referenceTypeId", "referenceId", "statusId", "createdAt", "createdByUserId") FROM stdin;
\.


--
-- Data for Name: WalletRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WalletRequest" (id, "walletId", "userId", "typeId", amount, reason, "statusId", "requestedAt", "resolvedAt", "clientId", "resolvedByUserId") FROM stdin;
14	5	11	32	5000.00	Bonus credit	34	2026-08-15 10:00:00	\N	1	\N
15	5	11	33	2000.00	Manual adjustment	34	2026-08-14 19:20:00	\N	1	\N
16	5	11	32	1000.00	Promotional adjustment	35	2026-08-01 10:30:00	2026-08-01 11:10:00	1	\N
17	5	11	33	500.00	Rule violation penalty	36	2026-04-30 20:20:00	2026-04-30 21:00:00	1	\N
\.


--
-- Data for Name: WalletTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WalletTransaction" (id, "walletId", "userId", "typeId", amount, "referenceTypeId", "referenceId", "statusId", "createdAt", "createdByUserId") FROM stdin;
25	5	11	21	1250.00	\N	\N	27	2026-08-15 08:15:00	\N
26	5	11	20	-500.00	\N	\N	27	2026-08-15 08:30:00	\N
27	5	11	23	5000.00	\N	\N	27	2026-08-15 20:45:00	\N
28	5	11	24	-2000.00	\N	\N	27	2026-08-14 19:20:00	\N
29	5	11	25	1000.00	\N	\N	27	2026-08-01 10:30:00	\N
30	5	11	21	-500.00	\N	\N	27	2026-07-09 09:10:00	\N
31	5	11	23	2000.00	\N	\N	27	2026-04-30 20:20:00	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
1e24ca3e-b3d0-43c3-bb17-9826434618ca	e4211f3e3ebc5733ee1bb7e3d53f674d67ae62f63bdf6c29b0458223d08800ed	2026-09-26 17:23:06.850693+05:30	20260926093401_lookup_normalization_and_audit	\N	\N	2026-09-26 17:23:06.631767+05:30	1
e571208e-2b9f-4034-a1b7-27fae2a79b4c	bbd04f4fb49d82127cd4fc23b221ea8bf631cf9e6917d9ef92b26186379c43d4	2026-09-26 17:23:06.865012+05:30	20260926093423_add_reporting_views	\N	\N	2026-09-26 17:23:06.851486+05:30	1
7649159a-b407-4388-a14a-3d63a989da9d	ca3150b29420a3748277f954a3dfde72e1e0cdf918f3feaadb9b9f3cbf84556c	2026-09-26 17:23:06.877134+05:30	20260926113229_seed_lookup_reference_data	\N	\N	2026-09-26 17:23:06.865907+05:30	1
4d8c258b-80a1-41f9-8b4c-2cc8e451070c	7a03869fe3fcda8552c7fa916851ff4124cdc4aa302dcef20adee045d7d094c6	2026-09-26 17:23:07.006127+05:30	20260926120000_isdeleted_as_int	\N	\N	2026-09-26 17:23:06.878134+05:30	1
446b25cb-8407-4e2b-9710-a4021781dd14	22d60542495dc869315b7236ec589bff398775bff596001462d45cace56b1b73	2026-09-26 17:41:10.281481+05:30	20260926121041_market_modified_by	\N	\N	2026-09-26 17:41:10.169325+05:30	1
4e123c19-2618-41a9-a908-d00ba60eadee	5f37bee771024ab6a96193b8729e1c17a9b6b6993c7f189b63058b2f0b4875a9	2026-09-26 17:43:46.622171+05:30	20260926123000_modified_by_user_id	\N	\N	2026-09-26 17:43:46.57691+05:30	1
9e4274d9-ccff-463b-bf57-79f299b20a5c	65609b01db2a5ed5049b827492b731e73efe8f8b12b731aa3a91197a829e8bef	2026-09-26 23:24:21.966452+05:30	20260926150000_rbac_multi_tenancy	\N	\N	2026-09-26 23:24:21.860712+05:30	1
eb241e47-ecde-4a5f-87d3-f63dc52fd1d5	83c1a1ac7de0c669e770728070f6e913aef9861c4dbeacd74b40edd0b20ff8a8	2026-09-28 02:01:29.666916+05:30	20260927060000_add_wallet_request_received_notification	\N	\N	2026-09-28 02:01:29.657962+05:30	1
\.


--
-- Name: BetSelectionLeg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."BetSelectionLeg_id_seq"', 21, true);


--
-- Name: Bet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Bet_id_seq"', 17, true);


--
-- Name: Client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Client_id_seq"', 2, true);


--
-- Name: Event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Event_id_seq"', 40, true);


--
-- Name: LookupType_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."LookupType_id_seq"', 11, true);


--
-- Name: Lookup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Lookup_id_seq"', 44, true);


--
-- Name: MarketSelection_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."MarketSelection_id_seq"', 104, true);


--
-- Name: Market_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Market_id_seq"', 48, true);


--
-- Name: Notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Notification_id_seq"', 24, true);


--
-- Name: PriceHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."PriceHistory_id_seq"', 184, true);


--
-- Name: Role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Role_id_seq"', 3, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."User_id_seq"', 11, true);


--
-- Name: WalletLedger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."WalletLedger_id_seq"', 3, true);


--
-- Name: WalletRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."WalletRequest_id_seq"', 17, true);


--
-- Name: WalletTransaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."WalletTransaction_id_seq"', 31, true);


--
-- Name: Wallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Wallet_id_seq"', 5, true);


--
-- Name: BetSelectionLeg BetSelectionLeg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_pkey" PRIMARY KEY (id);


--
-- Name: Bet Bet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Event Event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY (id);


--
-- Name: LookupType LookupType_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LookupType"
    ADD CONSTRAINT "LookupType_pkey" PRIMARY KEY (id);


--
-- Name: Lookup Lookup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lookup"
    ADD CONSTRAINT "Lookup_pkey" PRIMARY KEY (id);


--
-- Name: MarketSelection MarketSelection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_pkey" PRIMARY KEY (id);


--
-- Name: Market Market_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PriceHistory PriceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PriceHistory"
    ADD CONSTRAINT "PriceHistory_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WalletLedger WalletLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_pkey" PRIMARY KEY (id);


--
-- Name: WalletRequest WalletRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_pkey" PRIMARY KEY (id);


--
-- Name: WalletTransaction WalletTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Wallet Wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: BetSelectionLeg_betId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BetSelectionLeg_betId_idx" ON public."BetSelectionLeg" USING btree ("betId");


--
-- Name: BetSelectionLeg_marketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BetSelectionLeg_marketId_idx" ON public."BetSelectionLeg" USING btree ("marketId");


--
-- Name: Bet_clientId_placedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Bet_clientId_placedAt_idx" ON public."Bet" USING btree ("clientId", "placedAt" DESC);


--
-- Name: Bet_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Bet_statusId_idx" ON public."Bet" USING btree ("statusId");


--
-- Name: Bet_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Bet_userId_idx" ON public."Bet" USING btree ("userId");


--
-- Name: Client_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Client_code_key" ON public."Client" USING btree (code);


--
-- Name: Event_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Event_categoryId_idx" ON public."Event" USING btree ("categoryId");


--
-- Name: Event_externalId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Event_externalId_key" ON public."Event" USING btree ("externalId");


--
-- Name: Event_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Event_statusId_idx" ON public."Event" USING btree ("statusId");


--
-- Name: LookupType_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LookupType_code_key" ON public."LookupType" USING btree (code);


--
-- Name: Lookup_lookupTypeId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Lookup_lookupTypeId_code_key" ON public."Lookup" USING btree ("lookupTypeId", code);


--
-- Name: Lookup_lookupTypeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lookup_lookupTypeId_idx" ON public."Lookup" USING btree ("lookupTypeId");


--
-- Name: MarketSelection_marketId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketSelection_marketId_idx" ON public."MarketSelection" USING btree ("marketId");


--
-- Name: MarketSelection_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MarketSelection_statusId_idx" ON public."MarketSelection" USING btree ("statusId");


--
-- Name: Market_eventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Market_eventId_idx" ON public."Market" USING btree ("eventId");


--
-- Name: Market_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Market_statusId_idx" ON public."Market" USING btree ("statusId");


--
-- Name: Notification_typeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_typeId_idx" ON public."Notification" USING btree ("typeId");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: PriceHistory_symbol_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PriceHistory_symbol_timestamp_idx" ON public."PriceHistory" USING btree (symbol, "timestamp");


--
-- Name: Role_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Role_code_key" ON public."Role" USING btree (code);


--
-- Name: User_clientId_roleId_isDeleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_clientId_roleId_isDeleted_idx" ON public."User" USING btree ("clientId", "roleId", "isDeleted");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_mobile_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_mobile_key" ON public."User" USING btree (mobile);


--
-- Name: User_userCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_userCode_key" ON public."User" USING btree ("userCode");


--
-- Name: WalletLedger_transactionTypeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletLedger_transactionTypeId_idx" ON public."WalletLedger" USING btree ("transactionTypeId");


--
-- Name: WalletLedger_walletId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletLedger_walletId_idx" ON public."WalletLedger" USING btree ("walletId");


--
-- Name: WalletRequest_clientId_statusId_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletRequest_clientId_statusId_requestedAt_idx" ON public."WalletRequest" USING btree ("clientId", "statusId", "requestedAt" DESC);


--
-- Name: WalletRequest_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletRequest_statusId_idx" ON public."WalletRequest" USING btree ("statusId");


--
-- Name: WalletRequest_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletRequest_userId_idx" ON public."WalletRequest" USING btree ("userId");


--
-- Name: WalletRequest_walletId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletRequest_walletId_idx" ON public."WalletRequest" USING btree ("walletId");


--
-- Name: WalletTransaction_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_statusId_idx" ON public."WalletTransaction" USING btree ("statusId");


--
-- Name: WalletTransaction_typeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_typeId_idx" ON public."WalletTransaction" USING btree ("typeId");


--
-- Name: WalletTransaction_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_userId_idx" ON public."WalletTransaction" USING btree ("userId");


--
-- Name: WalletTransaction_walletId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WalletTransaction_walletId_idx" ON public."WalletTransaction" USING btree ("walletId");


--
-- Name: Wallet_statusId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Wallet_statusId_idx" ON public."Wallet" USING btree ("statusId");


--
-- Name: Wallet_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Wallet_userId_key" ON public."Wallet" USING btree ("userId");


--
-- Name: User User_role_client_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "User_role_client_check" BEFORE INSERT OR UPDATE OF "roleId", "clientId" ON public."User" FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_client();


--
-- Name: BetSelectionLeg BetSelectionLeg_betId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_betId_fkey" FOREIGN KEY ("betId") REFERENCES public."Bet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BetSelectionLeg BetSelectionLeg_marketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BetSelectionLeg"
    ADD CONSTRAINT "BetSelectionLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES public."Market"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Bet Bet_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Bet Bet_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Bet Bet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Bet"
    ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Client Client_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Client Client_modifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Event Event_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Lookup Lookup_lookupTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lookup"
    ADD CONSTRAINT "Lookup_lookupTypeId_fkey" FOREIGN KEY ("lookupTypeId") REFERENCES public."LookupType"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MarketSelection MarketSelection_marketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES public."Market"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MarketSelection MarketSelection_modifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MarketSelection MarketSelection_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MarketSelection"
    ADD CONSTRAINT "MarketSelection_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Market Market_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Market Market_modifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Market Market_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_typeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_modifiedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletLedger WalletLedger_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletLedger WalletLedger_referenceTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_referenceTypeId_fkey" FOREIGN KEY ("referenceTypeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletLedger WalletLedger_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletLedger WalletLedger_transactionTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletLedger WalletLedger_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletLedger"
    ADD CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_resolvedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletRequest WalletRequest_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_typeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletRequest WalletRequest_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletRequest"
    ADD CONSTRAINT "WalletRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletTransaction WalletTransaction_referenceTypeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_referenceTypeId_fkey" FOREIGN KEY ("referenceTypeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WalletTransaction WalletTransaction_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_typeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WalletTransaction WalletTransaction_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Wallet Wallet_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public."Lookup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Wallet Wallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict l9ZwzUBLyrmEtRcBd8dsZeULrqcYuV2xSScRPwURxUTtYa0TPZp6TYsWzVn40k6

