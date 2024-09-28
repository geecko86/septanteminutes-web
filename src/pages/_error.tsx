import React, { useEffect } from 'react';
import { NextPageContext } from 'next';

import NotFoundPage from "./404"


interface ErrorProps {
  statusCode: number;
  err: Error;
  onReady: () => void;
}

class ErrorPage extends React.Component<ErrorProps> {
  static getInitialProps({ res, err }: NextPageContext) {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode, err };
  }
  
  render() {
    this.props.onReady();
    
    if (this.props.statusCode === 404) {
        return <NotFoundPage />;
    }

    fetch('https://europe-west1-septanteminutes.cloudfunctions.net/logError', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: this.props.err?.toString(),
        statusCode: `${this.props.statusCode}`,
        url: window.location.href,
      }),
    }).catch(console.error);

    return <NotFoundPage errorCode={this.props.statusCode || 500} error={this.props.err} />;
  }
}

export default ErrorPage;