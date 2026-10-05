import React from 'react';
import { MatchModule } from './MatchModule';

/**
 * ApprovalsModule has been unified into MatchModule as requested by co-founder Vismay Zaveri.
 * This file serves as a transparent forwarder to MatchModule.
 */
export const ApprovalsModule: React.FC = () => {
  return <MatchModule />;
};
