import 'styled-components';

/**
 * Styled components theme type definitions for the OmniWallet application
 * Extends the default styled-components theme with OmniWallet-specific design tokens
 */
declare module 'styled-components' {
    /**
     * Default theme interface with comprehensive design tokens
     */
    export interface DefaultTheme {
        /** Color palette for the application */
        colors: {
            /** Primary brand color */
            primary: string;
            /** Secondary brand color */
            secondary: string;
            /** Main background color */
            background: string;
            /** Alternative background color */
            backgroundAlt: string;
            /** Surface color for cards and overlays */
            surface: string;
            /** Error state color */
            error: string;
            /** Warning state color */
            warning: string;
            /** Success state color */
            success: string;
            /** Info state color */
            info: string;
            /** Text color definitions */
            text: {
                /** Primary text color */
                primary: string;
                /** Secondary text color */
                secondary: string;
                /** Disabled text color */
                disabled: string;
                /** Inverse text color */
                inverse: string;
            };
            /** Border color definitions */
            border: {
                /** Default border color */
                default: string;
                /** Light border color */
                light: string;
                /** Dark border color */
                dark: string;
            };
            /** Secondary text color (legacy) */
            textSecondary: string;
            /** Disabled state color */
            disabled: string;
        };
        /** Font family definitions */
        fonts: {
            /** Body text font */
            body: string;
            /** Heading font */
            heading: string;
        };
        /** Font size scale */
        fontSizes: {
            /** Small font size */
            small: string;
            /** Medium font size */
            medium: string;
            /** Large font size */
            large: string;
            /** Extra large font size */
            xlarge: string;
        };
        /** Spacing scale */
        spacing: {
            /** Small spacing */
            small: string;
            /** Medium spacing */
            medium: string;
            /** Large spacing */
            large: string;
        };
        /** Border radius scale */
        borderRadius: {
            /** Small border radius */
            small: string;
            /** Medium border radius */
            medium: string;
            /** Large border radius */
            large: string;
        };
        /** Shadow definitions */
        shadows: {
            /** Small shadow */
            small: string;
            /** Medium shadow */
            medium: string;
            /** Large shadow */
            large: string;
        };
    }
} 