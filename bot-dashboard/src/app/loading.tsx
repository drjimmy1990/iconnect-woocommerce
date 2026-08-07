// src/app/loading.tsx
import { Box, Skeleton } from '@mui/material';

export default function Loading() {
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar skeleton */}
      <Box sx={{ width: 320, p: 2 }}>
        <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 2 }} />
        {[...Array(8)].map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            width="100%"
            height={72}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>

      {/* Chat area skeleton */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Skeleton variant="rectangular" height={64} />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={i % 2 === 0 ? '40%' : '55%'}
              height={36}
              sx={{ mb: 2, ml: i % 2 === 0 ? 0 : 'auto', borderRadius: 2 }}
            />
          ))}
        </Box>
        <Skeleton variant="rectangular" height={72} />
      </Box>
    </Box>
  );
}