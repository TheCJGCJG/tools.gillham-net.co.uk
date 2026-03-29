import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NavBar from './index';

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

    test('renders GPX Parser link in dropdown', async () => {
        render(<NavBar />);
        // Open the dropdown
        const dropdownButton = screen.getByText('Tools');
        await userEvent.click(dropdownButton);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        const gpxParserLink = dropdownItems.find(item => item.textContent === 'GPX Parser');
        expect(gpxParserLink).toBeInTheDocument();
        expect(gpxParserLink).toHaveAttribute('href', '/gpx-parser');
    });

    test('renders Moving Network Speed Test link in dropdown', async () => {
        render(<NavBar />);
        const dropdownButton = screen.getByText('Tools');
        await userEvent.click(dropdownButton);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        const speedTestLink = dropdownItems.find(item => item.textContent === 'Moving Network Speed Test');
        expect(speedTestLink).toBeInTheDocument();
        expect(speedTestLink).toHaveAttribute('href', '/moving-network-speed-test');
    });

    test('renders both dropdown items when open', async () => {
        render(<NavBar />);
        const dropdownButton = screen.getByText('Tools');
        await userEvent.click(dropdownButton);
        const dropdownItems = screen.getAllByTestId('dropdown-item');
        expect(dropdownItems).toHaveLength(2);
    });
});
