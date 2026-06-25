-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  mobile_number text,
  email text,
  role text DEFAULT 'user',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_login timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Create photos table
DROP TABLE IF EXISTS public.photos CASCADE;

CREATE TABLE public.photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_id uuid,
  file_name text,
  storage_path text,
  file_url text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  uploaded_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Create folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  folder_name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Create indexes for large-scale performance
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_folder_id ON public.photos(folder_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON public.photos(uploaded_at DESC);

-- Folders RLS policies
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders"
  ON public.folders FOR SELECT
  USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can insert their own folders" ON public.folders;
CREATE POLICY "Users can insert their own folders"
  ON public.folders FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders"
  ON public.folders FOR UPDATE
  USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders"
  ON public.folders FOR DELETE
  USING ( auth.uid() = user_id );

-- Photos RLS policies
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;
CREATE POLICY "Users can view their own photos"
  ON public.photos FOR SELECT
  USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can insert their own photos" ON public.photos;
CREATE POLICY "Users can insert their own photos"
  ON public.photos FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos;
CREATE POLICY "Users can delete their own photos"
  ON public.photos FOR DELETE
  USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Admins can view all photos" ON public.photos;
CREATE POLICY "Admins can view all photos"
  ON public.photos FOR SELECT
  USING ( EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') );

-- Storage bucket setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- 1. SELECT (View) policy
DROP POLICY IF EXISTS "Users can view their own photos in storage" ON storage.objects;
CREATE POLICY "Users can view their own photos in storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING ( bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 2. TEMPORARY RELAXED INSERT POLICY (requested for testing/quick resolution)
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
CREATE POLICY "Users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- 3. RECOMMENDED SECURE INSERT POLICY (Use this once upload is verified to restrict folders strictly to user's auth.uid)
-- DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can upload their own photos to storage" ON storage.objects;
-- CREATE POLICY "Users can upload their own photos to storage"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK ( bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- 4. DELETE policy
DROP POLICY IF EXISTS "Users can delete their own photos from storage" ON storage.objects;
CREATE POLICY "Users can delete their own photos from storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING ( bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, mobile_number)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'user',
    new.raw_user_meta_data->>'mobile_number'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
