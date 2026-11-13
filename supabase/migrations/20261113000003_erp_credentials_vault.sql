-- =====================================================================
-- ERP 자동 등록용 계정 보관 (Supabase Vault 암호화 저장)
-- - 관리자 화면 [설정 > ERP 연결]에서 저장, 서버(/api/erp/register)만 꺼내 씀
-- - 관리자 이메일 목록(admin_users)에 있는 계정만 저장·조회 가능
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;  -- 정책 없음: API로는 읽기/쓰기 불가
INSERT INTO public.admin_users(email) VALUES ('threepeat.mkt@gmail.com') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

CREATE OR REPLACE FUNCTION public.set_erp_credentials(p_id TEXT, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '관리자만 설정할 수 있어요.'; END IF;
  IF coalesce(btrim(p_id), '') = '' THEN RAISE EXCEPTION 'ERP 아이디를 입력해주세요.'; END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'erp_id';
  IF v_id IS NULL THEN PERFORM vault.create_secret(btrim(p_id), 'erp_id', 'ERP 자동 등록 아이디');
  ELSE PERFORM vault.update_secret(v_id, btrim(p_id)); END IF;

  IF coalesce(p_password, '') <> '' THEN
    SELECT id INTO v_id FROM vault.secrets WHERE name = 'erp_password';
    IF v_id IS NULL THEN PERFORM vault.create_secret(p_password, 'erp_password', 'ERP 자동 등록 비밀번호');
    ELSE PERFORM vault.update_secret(v_id, p_password); END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_erp_credentials()
RETURNS TABLE(erp_id TEXT, erp_password TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '관리자만 사용할 수 있어요.'; END IF;
  RETURN QUERY SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'erp_id'),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'erp_password');
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_credentials_status()
RETURNS TABLE(configured BOOLEAN, erp_id_masked TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_id TEXT; v_has_pw BOOLEAN; v_upd TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '관리자만 볼 수 있어요.'; END IF;
  SELECT decrypted_secret INTO v_id FROM vault.decrypted_secrets WHERE name = 'erp_id';
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'erp_password') INTO v_has_pw;
  SELECT max(s.updated_at) INTO v_upd FROM vault.secrets s WHERE s.name IN ('erp_id', 'erp_password');
  RETURN QUERY SELECT
    (v_id IS NOT NULL AND v_has_pw),
    CASE WHEN v_id IS NULL THEN NULL
         WHEN position('@' IN v_id) > 0 THEN left(v_id, 3) || '***' || substr(v_id, position('@' IN v_id))
         ELSE left(v_id, 3) || '***' END,
    v_upd;
END;
$$;

REVOKE ALL ON FUNCTION public.set_erp_credentials(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_erp_credentials() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_credentials_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_erp_credentials(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_erp_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_credentials_status() TO authenticated;
