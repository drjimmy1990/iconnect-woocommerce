// src/components/crm/ClientTagsManager.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, TextField, Chip, Box, CircularProgress } from '@mui/material';
import { supabase } from '@/lib/supabaseClient';

interface ClientTagsManagerProps {
  // The tags are now controlled by the parent component
  tags: string[] | null;
  // This function will be called whenever the tags are changed in the UI
  onTagsChange: (newTags: string[]) => void;
}

async function fetchAllTags(): Promise<{ name: string }[]> {
  const { data, error } = await supabase
    .from('crm_tags')
    .select('name')
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export default function ClientTagsManager({ tags, onTagsChange }: ClientTagsManagerProps) {
  // This component no longer needs the useClient hook.
  
  const { data: allTags = [], isLoading: isLoadingTags } = useQuery<{ name: string }[]>({
    queryKey: ['allTags'],
    queryFn: fetchAllTags,
    staleTime: 1000 * 60 * 5,
  });
  
  const tagOptions = allTags.map(tag => tag.name);

  // When the user changes the tags in the Autocomplete component,
  // we simply call the function passed down from the parent.
  const handleTagsChange = (event: React.SyntheticEvent, newValue: string[]) => {
    onTagsChange(newValue);
  };

  return (
    <Box>
      <Autocomplete
        multiple
        id="client-tags-manager"
        // The value is now directly from props
        value={tags || []}
        onChange={handleTagsChange}
        options={tagOptions}
        loading={isLoadingTags}
        freeSolo
        renderTags={(value: readonly string[], getTagProps) =>
          value.map((option: string, index: number) => (
            <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
          ))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label="Tags"
            placeholder="Add or create tags"
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoadingTags ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </Box>
  );
}