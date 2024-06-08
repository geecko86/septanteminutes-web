import React from 'react';
import { NextPageContext } from 'next';

import NotFoundPage from "./404"


interface ErrorProps {
  statusCode: number;
}

class ErrorPage extends React.Component<ErrorProps> {
  static getInitialProps({ res, err }: NextPageContext) {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
  }
  
  render() {
    if (this.props.statusCode === 404) {
        return <NotFoundPage />;
    }

    return (
      <div>
        <h1>Erreur {this.props.statusCode}</h1>
      </div>
    );
  }
}

export default ErrorPage;