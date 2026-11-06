insert into public.permissions (key, label) values
 ('dashboard','Dashboard and analytics'),('customers','Customers'),('orders','Orders and quotations'),('products','Products and yarn'),('pricing','Prices and costing'),
 ('assistant','AI assistant'),('settings','Settings'),('admins','Admin users'),('production','Production board'),('support','Support tickets') on conflict do nothing;
insert into public.roles (key, label) values ('owner','Owner'),('admin','Administrator'),('manager','Manager'),('production','Production'),('support','Support'),('customer','Customer') on conflict do nothing;
insert into public.role_permissions (role, perm) values
 ('admin','dashboard'),('admin','customers'),('admin','orders'),('admin','products'),('admin','pricing'),('admin','assistant'),('admin','settings'),('admin','production'),('admin','support'),
 ('manager','dashboard'),('manager','customers'),('manager','orders'),('manager','products'),('manager','pricing'),
 ('production','production'),('production','orders'),('support','customers'),('support','support'),('support','orders') on conflict do nothing;
-- 13 production stages (wording is a proposal: edit freely)
insert into public.business_settings (key, value, is_public) values
 ('production_stages', '["Order received","Design review","Design approved","Payment confirmed","Materials ready","Backing prepared","Tufting","Carving and trimming","Finishing","Quality check","Packed","Dispatched","Delivered"]', true) on conflict do nothing;
