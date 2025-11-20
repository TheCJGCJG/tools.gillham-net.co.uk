import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavBar from './index';

// Mock react-bootstrap components if needed
jest.mock('react-bootstrap/Container', () => {
    return function Container({ children }) {
        return <div data-testid="container">{children}</div>;
    };
});

jest.mock('react-bootstrap/Nav', () => {
    const Nav = ({ children, className }) => (
        <nav data-testid="nav" className={className}>{children}</nav>
    );
    Nav.Link = ({ children, href }) => (
        <a data-testid="nav-link" href={href}>{children}</a>
    );
    return Nav;
});

jest.mock('react-bootstrap/Navbar', () => {
    const Navbar = ({ children, bg, expand }) => (
        <nav data-testid="navbar" data-bg={bg} data-expand={expand}>
            {children}
        </nav>
    );
    Navbar.Brand = ({ children, href }) => (
        <a data-testid="navbar-brand" href={href}>{children}</a>
    );
    Navbar.Toggle = ({ 'aria-controls': ariaControls }) => (
        <button data-testid="navbar-toggle" aria-controls={ariaControls}>Toggle</button>
    );
    Navbar.Collapse = ({ children, id }) => (
        <div data-testid="navbar-collapse" id={id}>{children}</div>
    );
    return Navbar;
});

jest.mock('react-bootstrap/NavDropdown', () => {
    const NavDropdown = ({ children, title, id }) => (
        <div data-testid="nav-dropdown" data-title={title} id={id}>
            {children}
        </div>
    );
    NavDropdown.Item = ({ children, href }) => (
        <a data-testid="dropdown-item" href={href}>{children}</a>
    );
    return NavDropdown;
});

describe('NavBar Component', () => {
    test('renders without crashing', () => {
        render(<NavBar />);
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    test('displays the brand name', () => {
        render(<NavBar />);
        const brand = screen.getByTestId('navbar-brand');
        expect(brand).toHaveTextContent('Gillham-Net Tools');
    });

    test('brand links to home page', () => {
        render(<NavBar />);
        const brand = screen.getByTestId('navbar-brand');
        expect(brand).toHaveAttribute('href', '/');
    });

    test('renders navbar with light background', () => {
        render(<NavBar />);
        const navbar = screen.getByTestId('navbar');
        expect(navbar).toHaveAttribute('data-bg', 'light');
    });

    test('renders navbar with expand on large screens', () => {
        render(<NavBar />);
        const navbar = screen.getByTestId('navbar');
        expect(navbar).toHaveAttribute('data-expand', 'lg');
    });

    test('renders navbar toggle button', () => {
        render(<NavBar />);
        const toggle = screen.getByTestId('navbar-toggle');
        expect(toggle).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-controls', 'basic-navbar-nav');
    });

    test('renders navbar collapse section', () => {
        render(<NavBar />);
        const collapse = screen.getByTestId('navbar-collapse');
        expect(collapse).toBeInTheDocument();
        expect(collapse).toHaveAttribute('id', 'basic-navbar-nav');
    });

    test('renders Tools dropdown', () => {
        render(<NavBar />);
        const dropdown = screen.getByTestId('nav-dropdown');
        expect(dropdown).toBeInTheDocument();
        expect(dropdown).toHaveAttribute('data-title', 'Tools');
    });

    test('renders GPX Parser link in dropdown', () => {
        render(<NavBar />);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        const gpxParserLink = dropdownItems.find(item =>
            item.textContent === 'GPX Parser'
        );
        expect(gpxParserLink).toBeInTheDocument();
        expect(gpxParserLink).toHaveAttribute('href', '/gpx-parser');
    });

    test('renders Moving Network Speed Test link in dropdown', () => {
        render(<NavBar />);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        const speedTestLink = dropdownItems.find(item =>
            item.textContent === 'Moving Network Speed Test'
        );
        expect(speedTestLink).toBeInTheDocument();
        expect(speedTestLink).toHaveAttribute('href', '/moving-network-speed-test');
    });

    test('renders both dropdown items', () => {
        render(<NavBar />);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        expect(dropdownItems).toHaveLength(2);
    });

    test('renders nav with correct className', () => {
        render(<NavBar />);
        const nav = screen.getByTestId('nav');
        expect(nav).toHaveClass('me-auto');
    });
});
