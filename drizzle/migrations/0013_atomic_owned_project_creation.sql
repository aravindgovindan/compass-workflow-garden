CREATE FUNCTION public.create_owned_project(_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects;
BEGIN
  IF auth.uid() IS NULL OR public.is_demo_user(auth.uid()) THEN RAISE EXCEPTION 'Project creation denied'; END IF;
  IF length(trim(_input->>'name')) NOT BETWEEN 2 AND 120
    OR (_input->>'code') !~ '^[A-Z][A-Z0-9]{1,9}$'
    OR (_input->>'status') NOT IN ('planning','active','on_hold','completed')
    OR (_input->>'health') NOT IN ('green','amber','red') THEN
    RAISE EXCEPTION 'Invalid project profile';
  END IF;
  INSERT INTO public.projects(name,code,description,objectives,sponsor,start_date,target_end_date,status,health,created_by)
  VALUES(trim(_input->>'name'),_input->>'code',_input->>'description',_input->>'objectives',_input->>'sponsor',
    NULLIF(_input->>'start_date','')::date,NULLIF(_input->>'target_end_date','')::date,
    _input->>'status',(_input->>'health')::public.project_health,auth.uid()) RETURNING * INTO p;
  RETURN jsonb_build_object('id',p.id,'name',p.name,'code',p.code);
END $$;
REVOKE ALL ON FUNCTION public.create_owned_project(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_owned_project(jsonb) TO authenticated;
