
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type AppStatus = 'idle' | 'analyzing' | 'dashboard';

export interface JobRecommendation {
    title: string;
    company: string;
    salary_range: string;
    apply_link: string;
    match_score: number;
}

export interface AnalysisResult {
    personal_info: {
        name: string;
        email: string;
    };
    predicted_role: string;
    executive_summary: string;
    skills: string[];
    experience_years: string;
    improvements: {
        type: 'critical' | 'recommended';
        suggestion: string;
    }[];
    jobs: JobRecommendation[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

// Added Artifact interface to resolve the import error in ArtifactCard.tsx
export interface Artifact {
    id: string;
    html: string;
    styleName: string;
    status: 'streaming' | 'complete' | string;
}
