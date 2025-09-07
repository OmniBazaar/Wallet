/**
 * Theme interface for styled-components
 * Defines the structure of the theme object used throughout the application
 */
export interface Theme {
  /** Color palette for the application */
  colors: {
    /** Primary brand color */
    primary: string;
    /** Secondary brand color */
    secondary: string;
    /** Background color */
    background: string;
    /** Alternative background color */
    backgroundAlt: string;
    /** Surface color for cards and panels */
    surface: string;
    /** Error state color */
    error: string;
    /** Warning state color */
    warning: string;
    /** Success state color */
    success: string;
    /** Info state color */
    info: string;
    /** Text colors */
    text: {
      /** Primary text color */
      primary: string;
      /** Secondary text color */
      secondary: string;
      /** Disabled text color */
      disabled: string;
      /** Inverse text color (for dark backgrounds) */
      inverse: string;
    };
    /** Border colors */
    border: {
      /** Default border color */
      default: string;
      /** Light border color */
      light: string;
      /** Dark border color */
      dark: string;
    };
  };
  /** Typography settings */
  typography: {
    /** Font families */
    fontFamily: {
      /** Primary font family */
      primary: string;
      /** Monospace font family */
      mono: string;
    };
    /** Font sizes */
    fontSize: {
      /** Extra small font size */
      xs: string;
      /** Small font size */
      sm: string;
      /** Medium font size */
      md: string;
      /** Large font size */
      lg: string;
      /** Extra large font size */
      xl: string;
    };
    /** Font weights */
    fontWeight: {
      /** Normal font weight */
      normal: number;
      /** Medium font weight */
      medium: number;
      /** Bold font weight */
      bold: number;
    };
  };
  /** Spacing values */
  spacing: {
    /** Extra small spacing */
    xs: string;
    /** Small spacing */
    sm: string;
    /** Medium spacing */
    md: string;
    /** Large spacing */
    lg: string;
    /** Extra large spacing */
    xl: string;
  };
  /** Border radius values */
  borderRadius: {
    /** Small border radius */
    sm: string;
    /** Medium border radius */
    md: string;
    /** Large border radius */
    lg: string;
    /** Full border radius (circle) */
    full: string;
  };
  /** Shadow definitions */
  shadows: {
    /** Small shadow */
    sm: string;
    /** Medium shadow */
    md: string;
    /** Large shadow */
    lg: string;
  };
  /** Breakpoints for responsive design */
  breakpoints: {
    /** Small screen breakpoint */
    sm: string;
    /** Medium screen breakpoint */
    md: string;
    /** Large screen breakpoint */
    lg: string;
    /** Extra large screen breakpoint */
    xl: string;
  };
}

/** Styled-components theme declaration */
declare module 'styled-components' {
  export interface DefaultTheme extends Theme {}
}