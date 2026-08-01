export interface Episode {
  id: string;
  scope: string;
  content: string;
  content_hash: string;
  created_at: string;
  consolidated_into: string | null;
}

export interface Memory {
  id: string;
  scope: string;
  gist: string;
  details: string | null;
  salience: number;
  salience_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface Trait {
  id: string;
  scope: string;
  name: string;
  value: string;
  evidence: string | null;
  created_at: string;
  updated_at: string;
}
