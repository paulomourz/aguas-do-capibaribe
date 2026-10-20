--
-- PostgreSQL database dump
--

\restrict bIiL4YjQ96BShSLRh0e7HEh0ce9sFRNwXB4NZ9MOdxojbXFl8RhRh6Z5DAxjLbF

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-10-14 19:42:24

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
-- TOC entry 231 (class 1255 OID 16898)
-- Name: bloquear_alteracao_lote(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.bloquear_alteracao_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Lote não pode ser alterado nem excluído.';
END;
$$;


ALTER FUNCTION public.bloquear_alteracao_lote() OWNER TO postgres;

--
-- TOC entry 230 (class 1255 OID 16896)
-- Name: preencher_esperado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.preencher_esperado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_unidade VARCHAR(4);
    v_meta    NUMERIC(10,2);
BEGIN
    -- usuário desativado não registra lote
    IF NOT EXISTS (SELECT 1 FROM usuario WHERE id = NEW.usuario_id AND ativo = TRUE) THEN
        RAISE EXCEPTION 'Usuário inativo ou inexistente.';
    END IF;

    -- busca a meta do processo
    SELECT unidade, meta INTO v_unidade, v_meta
    FROM processo
    WHERE id = NEW.processo_id;

    IF v_unidade = 'peca' THEN
        NEW.esperado := v_meta * NEW.pecas;
    ELSE
        NEW.esperado := v_meta;
    END IF;

    RETURN NEW;   -- NEW = a linha que está sendo inserida
END;
$$;


ALTER FUNCTION public.preencher_esperado() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 16857)
-- Name: alerta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerta (
    id integer NOT NULL,
    processo_id integer NOT NULL,
    status character varying(10) DEFAULT 'aberto'::character varying NOT NULL,
    detectado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    CONSTRAINT alerta_status_check CHECK (((status)::text = ANY ((ARRAY['aberto'::character varying, 'analise'::character varying, 'resolvido'::character varying])::text[])))
);


ALTER TABLE public.alerta OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16856)
-- Name: alerta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerta_id_seq OWNER TO postgres;

--
-- TOC entry 5094 (class 0 OID 0)
-- Dependencies: 225
-- Name: alerta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerta_id_seq OWNED BY public.alerta.id;


--
-- TOC entry 227 (class 1259 OID 16875)
-- Name: alerta_lote; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerta_lote (
    lote_id integer NOT NULL,
    alerta_id integer NOT NULL
);


ALTER TABLE public.alerta_lote OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16829)
-- Name: lote; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lote (
    id integer NOT NULL,
    processo_id integer NOT NULL,
    usuario_id integer NOT NULL,
    pecas integer NOT NULL,
    litros numeric(12,2) NOT NULL,
    esperado numeric(14,2) NOT NULL,
    registrado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lote_esperado_check CHECK ((esperado > (0)::numeric)),
    CONSTRAINT lote_litros_check CHECK ((litros > (0)::numeric)),
    CONSTRAINT lote_pecas_check CHECK ((pecas > 0))
);


ALTER TABLE public.lote OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16828)
-- Name: lote_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lote_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lote_id_seq OWNER TO postgres;

--
-- TOC entry 5095 (class 0 OID 0)
-- Dependencies: 223
-- Name: lote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lote_id_seq OWNED BY public.lote.id;


--
-- TOC entry 222 (class 1259 OID 16811)
-- Name: processo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.processo (
    id integer NOT NULL,
    nome character varying(80) NOT NULL,
    unidade character varying(4) NOT NULL,
    meta numeric(10,2) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT processo_meta_check CHECK ((meta > (0)::numeric)),
    CONSTRAINT processo_nome_check CHECK ((length((nome)::text) > 0)),
    CONSTRAINT processo_unidade_check CHECK (((unidade)::text = ANY ((ARRAY['lote'::character varying, 'peca'::character varying])::text[])))
);


ALTER TABLE public.processo OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16810)
-- Name: processo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.processo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.processo_id_seq OWNER TO postgres;

--
-- TOC entry 5096 (class 0 OID 0)
-- Dependencies: 221
-- Name: processo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.processo_id_seq OWNED BY public.processo.id;


--
-- TOC entry 220 (class 1259 OID 16789)
-- Name: usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario (
    id integer NOT NULL,
    nome character varying(120) NOT NULL,
    login character varying(60) NOT NULL,
    senha_hash character varying(60) NOT NULL,
    perfil character varying(10) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usuario_login_check CHECK ((length((login)::text) >= 3)),
    CONSTRAINT usuario_nome_check CHECK ((length((nome)::text) > 0)),
    CONSTRAINT usuario_perfil_check CHECK (((perfil)::text = ANY ((ARRAY['gestor'::character varying, 'operador'::character varying])::text[]))),
    CONSTRAINT usuario_senha_hash_check CHECK ((length((senha_hash)::text) = 60))
);


ALTER TABLE public.usuario OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16788)
-- Name: usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_id_seq OWNER TO postgres;

--
-- TOC entry 5097 (class 0 OID 0)
-- Dependencies: 219
-- Name: usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_id_seq OWNED BY public.usuario.id;


--
-- TOC entry 229 (class 1259 OID 16905)
-- Name: v_alertas; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_alertas AS
 SELECT a.id AS alerta_id,
    p.nome AS processo,
    a.status,
    a.detectado_em,
    count(al.lote_id) AS qtd_lotes
   FROM ((public.alerta a
     JOIN public.processo p ON ((p.id = a.processo_id)))
     LEFT JOIN public.alerta_lote al ON ((al.alerta_id = a.id)))
  GROUP BY a.id, p.nome, a.status, a.detectado_em;


ALTER VIEW public.v_alertas OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16900)
-- Name: v_historico_lotes; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_historico_lotes AS
 SELECT l.id AS lote_id,
    l.usuario_id,
    p.nome AS processo,
    u.nome AS operador,
    l.pecas,
    l.litros,
    l.esperado,
    round((((l.litros - l.esperado) / l.esperado) * (100)::numeric), 2) AS desvio_percentual,
    l.registrado_em
   FROM ((public.lote l
     JOIN public.processo p ON ((p.id = l.processo_id)))
     JOIN public.usuario u ON ((u.id = l.usuario_id)));


ALTER VIEW public.v_historico_lotes OWNER TO postgres;

--
-- TOC entry 4892 (class 2604 OID 16860)
-- Name: alerta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta ALTER COLUMN id SET DEFAULT nextval('public.alerta_id_seq'::regclass);


--
-- TOC entry 4890 (class 2604 OID 16832)
-- Name: lote id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote ALTER COLUMN id SET DEFAULT nextval('public.lote_id_seq'::regclass);


--
-- TOC entry 4888 (class 2604 OID 16814)
-- Name: processo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processo ALTER COLUMN id SET DEFAULT nextval('public.processo_id_seq'::regclass);


--
-- TOC entry 4885 (class 2604 OID 16792)
-- Name: usuario id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id SET DEFAULT nextval('public.usuario_id_seq'::regclass);


--
-- TOC entry 5087 (class 0 OID 16857)
-- Dependencies: 226
-- Data for Name: alerta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerta (id, processo_id, status, detectado_em, atualizado_em) FROM stdin;
\.


--
-- TOC entry 5088 (class 0 OID 16875)
-- Dependencies: 227
-- Data for Name: alerta_lote; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerta_lote (lote_id, alerta_id) FROM stdin;
\.


--
-- TOC entry 5085 (class 0 OID 16829)
-- Dependencies: 224
-- Data for Name: lote; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lote (id, processo_id, usuario_id, pecas, litros, esperado, registrado_em) FROM stdin;
\.


--
-- TOC entry 5083 (class 0 OID 16811)
-- Dependencies: 222
-- Data for Name: processo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.processo (id, nome, unidade, meta, criado_em) FROM stdin;
\.


--
-- TOC entry 5081 (class 0 OID 16789)
-- Dependencies: 220
-- Data for Name: usuario; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuario (id, nome, login, senha_hash, perfil, ativo, criado_em) FROM stdin;
\.


--
-- TOC entry 5098 (class 0 OID 0)
-- Dependencies: 225
-- Name: alerta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alerta_id_seq', 1, false);


--
-- TOC entry 5099 (class 0 OID 0)
-- Dependencies: 223
-- Name: lote_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lote_id_seq', 1, false);


--
-- TOC entry 5100 (class 0 OID 0)
-- Dependencies: 221
-- Name: processo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.processo_id_seq', 1, false);


--
-- TOC entry 5101 (class 0 OID 0)
-- Dependencies: 219
-- Name: usuario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuario_id_seq', 1, false);


--
-- TOC entry 4923 (class 2606 OID 16881)
-- Name: alerta_lote alerta_lote_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta_lote
    ADD CONSTRAINT alerta_lote_pkey PRIMARY KEY (lote_id);


--
-- TOC entry 4920 (class 2606 OID 16869)
-- Name: alerta alerta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta
    ADD CONSTRAINT alerta_pkey PRIMARY KEY (id);


--
-- TOC entry 4918 (class 2606 OID 16845)
-- Name: lote lote_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote
    ADD CONSTRAINT lote_pkey PRIMARY KEY (id);


--
-- TOC entry 4911 (class 2606 OID 16827)
-- Name: processo processo_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processo
    ADD CONSTRAINT processo_nome_key UNIQUE (nome);


--
-- TOC entry 4913 (class 2606 OID 16825)
-- Name: processo processo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processo
    ADD CONSTRAINT processo_pkey PRIMARY KEY (id);


--
-- TOC entry 4907 (class 2606 OID 16809)
-- Name: usuario usuario_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_login_key UNIQUE (login);


--
-- TOC entry 4909 (class 2606 OID 16807)
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 1259 OID 16895)
-- Name: ix_alerta_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_alerta_status ON public.alerta USING btree (status);


--
-- TOC entry 4914 (class 1259 OID 16894)
-- Name: ix_lote_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_lote_data ON public.lote USING btree (registrado_em);


--
-- TOC entry 4915 (class 1259 OID 16893)
-- Name: ix_lote_processo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_lote_processo ON public.lote USING btree (processo_id);


--
-- TOC entry 4916 (class 1259 OID 16892)
-- Name: ix_lote_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_lote_usuario ON public.lote USING btree (usuario_id);


--
-- TOC entry 4929 (class 2620 OID 16897)
-- Name: lote trg_lote_esperado; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_lote_esperado BEFORE INSERT ON public.lote FOR EACH ROW EXECUTE FUNCTION public.preencher_esperado();


--
-- TOC entry 4930 (class 2620 OID 16899)
-- Name: lote trg_lote_imutavel; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_lote_imutavel BEFORE DELETE OR UPDATE ON public.lote FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_lote();


--
-- TOC entry 4927 (class 2606 OID 16887)
-- Name: alerta_lote alerta_lote_alerta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta_lote
    ADD CONSTRAINT alerta_lote_alerta_id_fkey FOREIGN KEY (alerta_id) REFERENCES public.alerta(id);


--
-- TOC entry 4928 (class 2606 OID 16882)
-- Name: alerta_lote alerta_lote_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta_lote
    ADD CONSTRAINT alerta_lote_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lote(id);


--
-- TOC entry 4926 (class 2606 OID 16870)
-- Name: alerta alerta_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerta
    ADD CONSTRAINT alerta_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.processo(id);


--
-- TOC entry 4924 (class 2606 OID 16846)
-- Name: lote lote_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote
    ADD CONSTRAINT lote_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.processo(id);


--
-- TOC entry 4925 (class 2606 OID 16851)
-- Name: lote lote_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote
    ADD CONSTRAINT lote_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);


-- Completed on 2026-10-14 19:42:25

--
-- PostgreSQL database dump complete
--

\unrestrict bIiL4YjQ96BShSLRh0e7HEh0ce9sFRNwXB4NZ9MOdxojbXFl8RhRh6Z5DAxjLbF

